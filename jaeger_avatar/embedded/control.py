"""avatar-control/v1: bounded, expiring presentation controls for one avatar."""
import math
import threading
import time
import uuid

class ControlError(ValueError): pass

def speech(v, numeric):
    """A speak value: an uploaded clip the host plays, how long it lasts, its lip closures, and its words."""
    if not isinstance(v,dict) or set(v)!={'clip','duration_ms','marks','text'}:raise ControlError('Speak needs clip, duration_ms, marks and text')
    clip,ms,marks,text=v['clip'],v['duration_ms'],v['marks'],v['text']
    if not isinstance(clip,str) or not clip.startswith('/control/audio/') or len(clip)>64:raise ControlError('Speak clip must be an uploaded /control/audio/ clip')
    if not numeric(ms) or not 1<=ms<=60000:raise ControlError('Speak duration_ms must be 1 to 60000')
    if not isinstance(text,str) or len(text)>600:raise ControlError('Speak text is at most 600 characters')
    if not isinstance(marks,list) or len(marks)>400:raise ControlError('Speak has at most 400 marks')
    for m in marks:
        if not (isinstance(m,list) and len(m)==3 and numeric(m[0]) and numeric(m[1]) and m[2] in ('p','f') and 0<=m[0]<=m[1]<=ms/1000):
            raise ControlError('Each mark is [start_s, end_s, "p" or "f"] inside the clip')
    return {'clip':clip,'duration_ms':ms,'marks':[list(m) for m in marks],'text':text}

class Controller:
    def __init__(self, manifest, clock=None):
        self.manifest=manifest
        self.clock=clock or (lambda:time.time()*1000)
        self.session=uuid.uuid4().hex
        self.sequence=0
        self.lock=threading.RLock()
        self.state={'stop_seq':0}
        self._reset()

    def _reset(self):
        self.state={'stop_seq':self.state['stop_seq'],'emotion':'neutral','reaction':'','reaction_seq':0,'gaze':[0,0],
                    'clip':'','clip_seq':0,'clip_started_at_ms':0,'clip_until_ms':0,
                    'speaking':False,'jaw':0,'emotion_until_ms':0,'gaze_until_ms':0,
                    'jaw_until_ms':0,'speaking_until_ms':0,'reaction_until_ms':0,
                    'act':'','act_seq':0,'act_until_ms':0,
                    'speak':None,'speak_seq':0,'speak_started_at_ms':0,'speak_until_ms':0}

    def send(self, op, value=None, ttl_ms=5000):
        with self.lock:
            return self.accept({'schema':'avatar-control/v1','avatar':self.manifest['avatar'],
                'session':self.session,'seq':self.sequence+1,'issued_at_ms':self.clock(),
                'ttl_ms':ttl_ms,'op':op,'value':value})

    def accept(self, msg):
        with self.lock:
            required={'schema','avatar','session','seq','issued_at_ms','ttl_ms','op','value'}
            if not isinstance(msg,dict) or set(msg)!=required: raise ControlError('Unexpected command fields')
            if msg['schema']!='avatar-control/v1' or msg['avatar']!=self.manifest['avatar'] or msg['session']!=self.session:
                raise ControlError('Wrong protocol, avatar or session')
            seq=msg['seq'];ttl=msg['ttl_ms'];at=msg['issued_at_ms'];now=self.clock()
            numeric=lambda v:isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
            if not isinstance(seq,int) or isinstance(seq,bool) or seq<=self.sequence:raise ControlError('Stale sequence')
            if not numeric(ttl) or not 1<=ttl<=30000 or not numeric(at) or at>now+1000 or now-at>=ttl:raise ControlError('Expired or invalid timing')
            op,v=msg['op'],msg['value'];until=at+ttl
            if op=='emotion':
                if v not in self.manifest['capabilities']['emotions']:raise ControlError('Unknown emotion')
                self.state.update(emotion=v,emotion_until_ms=until)
            elif op=='reaction':
                if v not in self.manifest['capabilities']['reactions']:raise ControlError('Unknown reaction')
                self.state.update(reaction=v,reaction_seq=seq,reaction_until_ms=until)
            elif op=='act':
                if not isinstance(v,str) or v not in self.manifest['capabilities'].get('actions',[]):raise ControlError('Unknown action')
                self.state.update(act=v,act_seq=seq,act_until_ms=until)
            elif op=='speak':
                v=speech(v,numeric)
                end=at+v['duration_ms']
                self.state.update(speak=v,speak_seq=seq,speak_started_at_ms=at,speak_until_ms=end,speaking=True,speaking_until_ms=end)
            elif op=='clip':
                if not isinstance(v,str) or v not in self.manifest['capabilities'].get('clips',{}):raise ControlError('Unknown clip')
                self.state.update(clip=v,clip_seq=seq,clip_started_at_ms=at,clip_until_ms=until)
            elif op=='gaze':
                if not isinstance(v,list) or len(v)!=2 or not all(numeric(x) and -1<=x<=1 for x in v):raise ControlError('Gaze must be two normalized values')
                self.state.update(gaze=list(v),gaze_until_ms=until)
            elif op=='speaking':
                if not isinstance(v,bool):raise ControlError('Speaking must be boolean')
                self.state.update(speaking=v,speaking_until_ms=until)
                if not v:self.state['jaw']=0;self.state['jaw_until_ms']=0
            elif op=='jaw':
                if not numeric(v) or not 0<=v<=1:raise ControlError('Jaw must be normalized')
                self.state.update(jaw=v,jaw_until_ms=until)
            elif op=='stop':
                if v is not None:raise ControlError('Stop has no value')
                self._reset();self.state['stop_seq']=seq
            else:raise ControlError('Unknown operation')
            self.sequence=seq
            return self.snapshot()

    def snapshot(self):
        with self.lock:
            now=self.clock();s=dict(self.state)
            for key,default in [('emotion','neutral'),('reaction',''),('gaze',[0,0]),('speaking',False),('jaw',0),('clip',''),('act',''),('speak',None)]:
                if now>=s[key+'_until_ms']:s[key]=default
            if not s['speaking']:s['jaw']=0
            return {'schema':'avatar-state/v1','avatar':self.manifest['avatar'],'session':self.session,
                    'seq':self.sequence,'server_time_ms':now,**s}
