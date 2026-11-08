"""EVE — the original CRT eyes, made expressive without redrawing them.

Fourth math character, and the first with a MOUTH. That is the whole
reason it exists: Orbs, HAL and Halo all say things without anything
moving that could be called speech, and a face that talks needs a part
that talks.

The source art in ``assets/eve.png`` is the eye material. Keeping that
material is important: the broad rounded shape, cyan centre, blue falloff
and tightly packed horizontal phosphor lines are EVE's design, not effects
to approximate with a couple of ellipses. Motion transforms those two
eyes; it never substitutes a new drawing for them.

TWO RIGS, NOT ONE.

    The EYES do what EVE's eyes do, which is almost entirely TILT.
    Angled inward is a glare, angled outward is worry, level is calm,
    and that one number carries more of her range than colour or size
    ever could. Plus gaze, blink, squint, size and spacing.

    The MOUTH is a row of segments whose heights follow the voice. It
    is not a shape that opens and closes on a timer — when the speaker
    is running it is reading `amplitude_param`, the same live signal
    Halo's ring reads, so the mouth moves because sound is happening.

    Shapes underneath it: line, smile, frown, o, wave. They describe
    how speech is illuminated, but there is NO resting light. At zero
    voice level the mouth is black and visually absent.

CONTROLS:

    STATE[curious]   idle happy sad angry curious scanning speaking sleeping
    LOOK[left] GAZE[x,y] BLINK[0..1] SQUINT[0..1]
    TILT[deg]        eye angle — the one that matters
    SIZE[n] SPACING[n] EYECOLOR[#8CE8FF]
    MOUTH[smile]     line smile frown o wave
    OPEN[0.6]        speaking mouth height
    LEVEL[0.8]       force the voice level, for scripting in silence
    SEGS[13] MOUTHCOLOR[#FFFFFF]
    GLOW[n] TEXTURE[n] PAN[x,y] SCALE[n] DIM[n] SPD[n]
    LAYERS[...] TUNE[...]
"""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

try:
    from plugin_core.mochi_animations import Animation
except ImportError:  # rendered outside the node — dev/tools/make_cards.py
    class Animation:  # noqa: D101
        def __init__(self, w: int, h: int) -> None:
            self.w, self.h = w, h

        def on_enter(self, **kwargs: Any) -> None: ...

        def on_event(self, event: str, **kwargs: Any) -> None: ...

        def set_size(self, w: int, h: int) -> None:
            self.w, self.h = w, h

TAU = math.pi * 2

#: Geometry measured from the actual reference. The lit-pixel centroids
#: are (154, 209) and (592, 209); the face itself is deliberately a few
#: pixels left of the mathematical centre of its 768 x 480 canvas.
REFERENCE_W, REFERENCE_H = 768, 480
LEFT_EYE_X, RIGHT_EYE_X = 154.0, 592.0
EYE_Y_PX = 209.0
FACE_X = ((LEFT_EYE_X + RIGHT_EYE_X) * 0.5) / REFERENCE_W
SPACING = (RIGHT_EYE_X - LEFT_EYE_X) / REFERENCE_W
EYE_Y = EYE_Y_PX / REFERENCE_H
MOUTH_Y = 378.0 / REFERENCE_H

# Public scale hint retained for scripts written against the first
# conversion. The visible eye body is about 260 px tall in the source.
EYE_R = 130.0 / REFERENCE_H

DEFAULT_EYE_TINT = (20, 211, 255)


def _load_reference() -> np.ndarray:
    path = Path(__file__).resolve().parent / "assets" / "eve.png"
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)


def _vertical_soften(image: np.ndarray, radius: int = 3) -> np.ndarray:
    """Remove the phosphor lines while retaining the original silhouette."""
    padded = np.pad(image, ((radius, radius), (0, 0), (0, 0)), mode="edge")
    return sum(padded[offset:offset + image.shape[0]]
               for offset in range(radius * 2 + 1)) / (radius * 2 + 1)


_REFERENCE = _load_reference()
_REFERENCE_SMOOTH = _vertical_soften(_REFERENCE)
_REFERENCE_LUMA = _REFERENCE.max(axis=2)
# Split the material into its luminous body and surrounding bloom so
# LAYERS remains useful. Added together at defaults, these are the source.
_CORE_ALPHA = np.clip((_REFERENCE_LUMA - 34.0) / 92.0, 0.0, 1.0)[:, :, None]
_REFERENCE_CORE = _REFERENCE * _CORE_ALPHA
_REFERENCE_HALO = _REFERENCE - _REFERENCE_CORE
_SMOOTH_CORE = _REFERENCE_SMOOTH * _CORE_ALPHA
_SMOOTH_HALO = _REFERENCE_SMOOTH - _SMOOTH_CORE


@lru_cache(maxsize=8)
def _reference_canvas(width: int, height: int) -> np.ndarray:
    """The untouched source art, contained without changing its aspect."""
    scale = min(width / REFERENCE_W, height / REFERENCE_H)
    draw_w = max(1, round(REFERENCE_W * scale))
    draw_h = max(1, round(REFERENCE_H * scale))
    resized = Image.fromarray(_REFERENCE.astype(np.uint8)).resize(
        (draw_w, draw_h), Image.Resampling.LANCZOS)
    canvas = np.zeros((height, width, 3), dtype=np.float32)
    x0, y0 = (width - draw_w) // 2, (height - draw_h) // 2
    canvas[y0:y0 + draw_h, x0:x0 + draw_w] = np.asarray(
        resized, dtype=np.float32)
    return canvas


@lru_cache(maxsize=16)
def _eye_material(texture: float, core: bool, halo: bool,
                  glow: float, colour: tuple[int, int, int]) -> np.ndarray:
    amount = float(np.clip(texture, 0.0, 1.0))
    material = np.zeros_like(_REFERENCE)
    if core:
        material += _SMOOTH_CORE * (1.0 - amount) + _REFERENCE_CORE * amount
    if halo:
        bloom = max(0.0, glow)
        material += (_SMOOTH_HALO * (1.0 - amount)
                     + _REFERENCE_HALO * amount) * bloom
    if not np.allclose(colour, DEFAULT_EYE_TINT, atol=1.0):
        # Preserve every phosphor value and edge, changing only its hue.
        intensity = material.max(axis=2, keepdims=True) / 255.0
        material = intensity * np.asarray(colour, dtype=np.float32)[None, None, :]
    return material

#: Mouth shapes: the relative height of each lit speech segment across
#: the row, sampled at u in 0..1. With no voice, none of them are drawn.
SHAPES: dict[str, Any] = {
    "line":  lambda u: 0.32 + 0.0 * u,
    "smile": lambda u: 0.22 + 0.85 * (1 - (2 * u - 1) ** 2) ** 1.4,
    "frown": lambda u: 0.95 - 0.72 * (1 - (2 * u - 1) ** 2) ** 1.4,
    "o":     lambda u: 0.25 + 1.15 * np.exp(-((u - 0.5) ** 2) / 0.018),
    "wave":  lambda u: 0.45 + 0.35 * np.sin(u * TAU * 1.5),
}

STATES: dict[str, dict] = {
    "idle":     {},
    "happy":    {"tilt": -7, "mouth": "smile", "open": 0.55, "squint": 0.18,
                 "eyecolor": "#9CF0FF"},
    "sad":      {"tilt": 16, "mouth": "frown", "open": 0.35, "gaze": (0, 0.35)},
    "angry":    {"tilt": -26, "mouth": "line", "open": 0.30, "squint": 0.34,
                 "eyecolor": "#7FD8FF", "glow": 1.4},
    "curious":  {"tilt": -4, "roll": 8, "mouth": "o", "open": 0.45,
                 "gaze": (0.3, -0.2)},
    "scanning": {"scan": 1.0, "mouth": "line", "open": 0.25, "squint": 0.1},
    "speaking": {"mouth": "wave", "open": 0.5},
    "sleeping": {"blink": 0.92, "open": 0.16, "glow": 0.5, "dim": 0.65},
}

AIM = {"left": (-0.8, 0.0), "right": (0.8, 0.0), "up": (0.0, -0.7),
       "down": (0.0, 0.7), "center": (0.0, 0.0), "centre": (0.0, 0.0)}


def _number(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _rgb(value: Any, fallback: tuple) -> tuple:
    if isinstance(value, str) and "," in value:
        value = [p.strip() for p in value.split(",")]
    if isinstance(value, (list, tuple)) and len(value) == 3:
        try:
            return tuple(max(0, min(255, int(float(c)))) for c in value)
        except (TypeError, ValueError):
            return fallback
    if isinstance(value, str) and value.startswith("#") and len(value) == 7:
        try:
            return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))
        except ValueError:
            return fallback
    return fallback


def _pair(value: Any, fallback: tuple) -> tuple:
    if isinstance(value, str):
        word = value.strip().lower()
        if word in AIM:
            return AIM[word]
        parts = word.split(",")
        if len(parts) == 2:
            return (_number(parts[0], fallback[0]),
                    _number(parts[1], fallback[1]))
        return fallback
    if isinstance(value, (list, tuple)) and len(value) == 2:
        return (_number(value[0], fallback[0]), _number(value[1], fallback[1]))
    return fallback


def _names(value: Any, fallback: tuple) -> tuple:
    if isinstance(value, str) and value.strip():
        return tuple(p.strip() for p in value.split(",") if p.strip())
    if isinstance(value, (list, tuple)):
        return tuple(str(p) for p in value)
    return tuple(fallback)


def _path_from(params: dict) -> Any:
    try:
        from core.tween import path_from
    except ImportError:
        return None
    return path_from(params)


class Eye:
    """One transformable instance of an eye from the source artwork."""

    def __init__(self) -> None:
        self.tilt = 0.0          # degrees, mirrored between the two
        self.gaze = (0.0, 0.0)
        self.blink = 0.0
        self.squint = 0.0
        self.scale = 1.0

    def draw(self, rgb: np.ndarray, cx: float, cy: float, fit: float,
             source_x: float, material: np.ndarray, side: int,
             roll: float) -> None:
        """Inverse-map the real CRT eye through the current pose."""
        sx = fit * max(0.02, self.scale)
        sy = sx * max(0.025, 1.0 - self.blink) \
            * max(0.2, 1.0 - 0.55 * self.squint)
        if sy <= 0.05:
            return

        cx += self.gaze[0] * 18.0 * fit
        cy += self.gaze[1] * 18.0 * fit
        # 190 px includes the source's entire soft blue falloff.
        pad = 190.0 * max(sx, sy)
        x0 = max(0, int(cx - pad)); x1 = min(rgb.shape[1], int(cx + pad) + 1)
        y0 = max(0, int(cy - pad)); y1 = min(rgb.shape[0], int(cy + pad) + 1)
        if x1 <= x0 or y1 <= y0:
            return
        view = rgb[y0:y1, x0:x1]
        xs = np.arange(x0, x1, dtype=np.float32) - cx + 0.5
        ys = np.arange(y0, y1, dtype=np.float32) - cy + 0.5
        dx = np.broadcast_to(xs[None, :], view.shape[:2])
        dy = np.broadcast_to(ys[:, None], view.shape[:2])

        # Mirrored, so a tilt is a matching pair of angles rather than
        # two eyes leaning the same way, which reads as a head tilt.
        turn = math.radians(self.tilt * side + roll)
        c, s = math.cos(turn), math.sin(turn)
        u, v = dx * c + dy * s, -dx * s + dy * c
        source_cols = source_x + u / sx
        source_rows = EYE_Y_PX + v / sy
        ix = np.rint(source_cols).astype(np.int32)
        iy = np.rint(source_rows).astype(np.int32)
        valid = ((ix >= 0) & (ix < REFERENCE_W)
                 & (iy >= 0) & (iy < REFERENCE_H)
                 & (np.abs(source_cols - source_x) <= 190.0)
                 & (np.abs(source_rows - EYE_Y_PX) <= 190.0))
        if not valid.any():
            return
        sampled = np.zeros_like(view)
        sampled[valid] = material[iy[valid], ix[valid]]
        view += sampled


class Mouth:
    """A row of light segments. The new rig.

    A SHAPE sets the illuminated speech profile. With no live voice level,
    every segment decays all the way to black.
    """

    def __init__(self, segments: int = 13) -> None:
        self.segments = max(3, int(segments))
        self.values = np.zeros(self.segments, dtype=np.float32)
        self.shape = "line"
        self.open = 0.4
        self.smooth = 0.4

    def resize(self, segments: int) -> None:
        segments = max(3, int(segments))
        if segments != self.segments:
            self.segments = segments
            self.values = np.zeros(segments, dtype=np.float32)

    def step(self, clock: float, level: float) -> np.ndarray:
        u = (np.arange(self.segments, dtype=np.float32) + 0.5) / self.segments
        profile = np.asarray(
            SHAPES.get(self.shape, SHAPES["line"])(u), dtype=np.float32)
        profile = np.broadcast_to(profile, (self.segments,)).copy()
        if level > 0.015:
            # Speech: the middle moves most, because that is where a
            # mouth opens. A flat multiply makes the whole bar pump,
            # which reads as a graphic equaliser, not a face.
            middle = np.clip(1 - np.abs(u - 0.5) * 1.4, 0, 1)
            profile = profile * (0.18 + 1.7 * level * middle)
            profile *= 1 + 0.12 * np.sin(u * TAU * 3 + clock * 9)
            target = np.clip(profile * self.open, 0.0, 1.6)
        else:
            target = np.zeros_like(profile)
        self.values += (target - self.values) * self.smooth
        return self.values


class Eve(Animation):
    """Two source-faithful CRT eyes and a speech-only illuminated mouth."""

    amplitude_param: float = 0.0

    def __init__(self, width: int, height: int) -> None:
        super().__init__(int(width), int(height))
        self.left, self.right = Eye(), Eye()
        self.mouth = Mouth()
        self.state = "idle"
        self._path = None
        self._move_s = 1.0
        self._level = 0.0
        self.pan = (0.0, 0.0)
        self.scale = 1.0
        self.spacing = 1.0
        self.roll = 0.0
        self.glow = 1.0
        self.texture = 1.0
        self.scan = 0.0
        self.dim = 1.0
        self.speed = 1.0
        self.forced = -1.0
        self.only: tuple = ()
        self.background = (0, 0, 0)
        self.tints = {"eye": DEFAULT_EYE_TINT, "mouth": (226, 250, 255),
                      "panel": (10, 26, 36)}

    @property
    def eyes(self) -> tuple:
        return (self.left, self.right)

    def on_enter(self, **kwargs: Any) -> None:
        params = {str(k).lower(): v for k, v in kwargs.items()}
        if "waypoints" in params or "path" in params:
            self._path = _path_from(params)
            self._move_s = _number(params.get("duration"), 1.0)

        def pick(*names, default=None):
            for name in names:
                if params.get(name) not in (None, ""):
                    return params[name]
            return default

        state = str(pick("state", default="idle")).lower()
        self.state = state if state in STATES else "idle"
        preset = STATES[self.state]

        self.speed = _number(pick("speed", "spd"), 1.0)
        self.pan = _pair(pick("pan"), preset.get("pan", (0.0, 0.0)))
        self.scale = _number(pick("scale"), preset.get("scale", 1.0))
        self.spacing = _number(pick("spacing"), preset.get("spacing", 1.0))
        self.roll = _number(pick("roll"), preset.get("roll", 0.0))
        self.glow = _number(pick("glow"), preset.get("glow", 1.0))
        self.texture = _number(pick("texture"), preset.get("texture", 1.0))
        self.scan = _number(pick("scan"), preset.get("scan", 0.0))
        self.dim = _number(pick("dim"), preset.get("dim", 1.0))
        self.forced = _number(pick("level"), preset.get("level", -1.0))
        self.only = _names(pick("layers"), preset.get("layers", ()))
        self.background = _rgb(pick("background", "bg"), self.background)
        self.tints["eye"] = _rgb(pick("eyecolor") or preset.get("eyecolor"),
                                 self.tints["eye"])
        self.tints["mouth"] = _rgb(pick("mouthcolor")
                                   or preset.get("mouthcolor"),
                                   self.tints["mouth"])
        self.tints["panel"] = _rgb(pick("color") or preset.get("color"),
                                   self.tints["panel"])

        for eye in self.eyes:
            eye.tilt = _number(pick("tilt"), preset.get("tilt", 0.0))
            eye.gaze = _pair(pick("gaze", "look"),
                             preset.get("gaze", (0.0, 0.0)))
            eye.blink = _number(pick("blink"), preset.get("blink", 0.0))
            eye.squint = _number(pick("squint"), preset.get("squint", 0.0))
            eye.scale = _number(pick("size"), preset.get("size", 1.0))
        wink = str(pick("wink", default="")).strip().lower()
        if wink in ("left", "right"):
            (self.left if wink == "left" else self.right).blink = 1.0

        self.mouth.resize(_number(pick("segs"), preset.get("segs", 13)))
        self.mouth.shape = str(pick("mouth") or preset.get("mouth", "line"))
        self.mouth.open = _number(pick("open"), preset.get("open", 0.4))

    def on_event(self, event: str, **kwargs: Any) -> None:
        if event in STATES:
            self.on_enter(state=event, **kwargs)
        elif event in AIM:
            for eye in self.eyes:
                eye.gaze = AIM[event]
        elif kwargs:
            self.on_enter(state=self.state, **kwargs)

    def level(self) -> float:
        """How loud. Same three rungs as Halo, and the same decay — a
        mouth that snaps shut between chunks chatters."""
        if self.forced >= 0:
            return max(0.0, min(1.0, self.forced))
        live = max(0.0, min(1.0, float(self.amplitude_param or 0.0)))
        self._level = max(live, self._level * 0.80)
        return self._level

    def render_into(self, t: float, frame_rgb: np.ndarray) -> None:
        if self._path is not None:
            self.on_enter(**self._path.at(t / max(1e-6, self._move_s)))
        height, width = frame_rgb.shape[0], frame_rgb.shape[1]
        clock = t * self.speed
        loud = self.level()

        rgb = np.zeros((height, width, 3), dtype=np.float32)
        rgb[:, :] = self.background
        short = min(width, height)
        fit = min(width / REFERENCE_W, height / REFERENCE_H)
        origin_x = (width - REFERENCE_W * fit) * 0.5
        origin_y = (height - REFERENCE_H * fit) * 0.5
        face_scale = max(0.05, self.scale)
        gap = (RIGHT_EYE_X - LEFT_EYE_X) * 0.5 * fit \
            * self.spacing * face_scale
        cx = origin_x + REFERENCE_W * FACE_X * fit \
            + self.pan[0] * width * 0.5
        cy = origin_y + EYE_Y_PX * fit + self.pan[1] * height * 0.5

        eye_ink = np.asarray(self.tints["eye"], dtype=np.float32)
        mouth_ink = np.asarray(self.tints["mouth"], dtype=np.float32)

        def wanted(name: str) -> bool:
            return not self.only or name in self.only

        core, halo = wanted("eyes"), wanted("halo")
        eye_texture = self.texture if (not self.only or wanted("texture")) else 0.0
        reference_pose = (
            core and halo and abs(eye_texture - 1.0) < 1e-6
            and abs(self.glow - 1.0) < 1e-6
            and abs(self.scale - 1.0) < 1e-6
            and abs(self.spacing - 1.0) < 1e-6
            and abs(self.roll) < 1e-6 and self.pan == (0.0, 0.0)
            and np.allclose(eye_ink, DEFAULT_EYE_TINT, atol=1.0)
            and all(abs(eye.tilt) < 1e-6 and eye.gaze == (0.0, 0.0)
                    and abs(eye.blink) < 1e-6 and abs(eye.squint) < 1e-6
                    and abs(eye.scale - 1.0) < 1e-6 for eye in self.eyes)
        )

        # The neutral pose is the source design pixel-for-pixel. Other
        # poses transform that same material; they never redraw an ellipse.
        if reference_pose:
            rgb += _reference_canvas(width, height)
        elif core or halo:
            material = _eye_material(
                round(float(eye_texture), 4), core, halo,
                round(float(self.glow), 4),
                tuple(int(value) for value in eye_ink))
            roll = math.radians(self.roll)
            for side, eye, source_x in zip(
                    (-1, 1), self.eyes, (LEFT_EYE_X, RIGHT_EYE_X)):
                ex, ey = side * gap, 0.0
                eye.draw(rgb, cx + ex * math.cos(roll) - ey * math.sin(roll),
                         cy + ex * math.sin(roll) + ey * math.cos(roll),
                         fit * face_scale, source_x, material, side, self.roll)

        # ── the mouth: segments of light under the eyes ──
        bars = self.mouth.step(clock, loud)
        if wanted("mouth"):
            span = 110.0 * fit * face_scale
            my = origin_y + MOUTH_Y * REFERENCE_H * fit \
                + self.pan[1] * height * 0.5
            unit = span * 2 / self.mouth.segments
            for index, value in enumerate(bars):
                if value <= 0.003:
                    continue
                bx = cx - span + unit * (index + 0.5)
                half_h = max(0.6, short * 0.052 * float(value))
                half_w = unit * 0.34
                # A segment's own window. Painting each one across the
                # whole frame is thirteen full-frame passes and was most
                # of the render cost — 22ms down to 3.
                x0 = max(0, int(bx - half_w - 2))
                x1 = min(width, int(bx + half_w + 2) + 1)
                y0 = max(0, int(my - half_h - 2))
                y1 = min(height, int(my + half_h + 2) + 1)
                if x1 <= x0 or y1 <= y0:
                    continue
                sx = np.clip((half_w - np.abs(
                    np.arange(x0, x1, dtype=np.float32) - bx + 0.5)) * 1.6, 0, 1)
                sy = np.clip((half_h - np.abs(
                    np.arange(y0, y1, dtype=np.float32) - my + 0.5)) * 1.6, 0, 1)
                rgb[y0:y1, x0:x1] += (sy[:, None] * sx[None, :])[:, :, None] \
                    * mouth_ink

        # Scanning light is confined to already-lit pixels. The old global
        # stripe filled the black bridge and invented a third, central eye.
        if self.scan:
            rows = np.arange(height, dtype=np.float32)
            band = ((clock * 0.35) % 1.0) * height * 1.4 - height * 0.2
            glowline = np.clip(1 - np.abs(rows - band) / (height * 0.05), 0, 1)
            lit = np.clip(rgb.max(axis=2) / 100.0, 0.0, 1.0)
            rgb += glowline[:, None, None] * lit[:, :, None] \
                * eye_ink * 0.22 * self.scan

        rgb *= max(0.0, self.dim)
        np.clip(rgb, 0, 255, out=rgb)
        frame_rgb[:, :] = rgb.astype(np.uint8)
