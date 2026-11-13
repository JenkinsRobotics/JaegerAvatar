#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements-app.txt || { rm -rf .venv; exit 1; }   # so the next run tries again
fi
# The agent (the model, its voice and its hearing) has its own environment: JaegerOS needs Python 3.11 or 3.12.
# The first install builds llama.cpp and takes some minutes. Without it the app still runs, on scripted replies.
case " $* " in *" --scripted "*) ;; *)
  if [ ! -x "${JAEGER_AGENT_PYTHON:-.agent-venv/bin/python}" ]; then
    py=$(command -v python3.12 || command -v python3.11 || true)
    if [ -z "$py" ]; then
      echo "No Python 3.11 or 3.12 here, so no agent: scripted replies only. Install one and run again." >&2
    elif "$py" -m venv .agent-venv && .agent-venv/bin/python -m pip install -r requirements-agent.txt; then :
    else
      rm -rf .agent-venv
      echo "The agent did not install (see above): scripted replies only. The next run tries again." >&2
    fi
  fi ;;
esac
exec .venv/bin/python -m jaeger_avatar "$@"
