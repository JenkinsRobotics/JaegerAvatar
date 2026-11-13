"""Launch the local Jaeger Avatar application."""
import argparse
import os
from pathlib import Path
import runpy
import sys

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8790)
    parser.add_argument('--scripted',action='store_true',help='Run without a conversational model')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    os.environ['JAEGER_AVATAR_PORT']=str(args.port)
    if args.scripted:os.environ['NORI_BRAIN']='scripted'
    os.environ.setdefault('HF_HOME',str(root/'app/.cache/hf'))
    if os.environ.get('JAEGER_AVATAR_LOOP','1')=='0':   # the old in-app path: a plain model, no tools. The voice loop keeps the agent's tools.
        os.environ.setdefault('JAEGER_AGENT_NO_TOOLS','1')
        os.environ.setdefault('JAEGER_AGENT_NO_SKILLS','1')
    sys.path.insert(0,str(root/'app'))
    runpy.run_path(str(root/'app/server.py'),run_name='__main__')

if __name__=='__main__':main()
