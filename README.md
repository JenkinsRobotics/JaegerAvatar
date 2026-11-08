<h1 align="center">Jaeger Avatar</h1>
<p align="center"><strong>Create a character. Give it a voice. Bring it to life.</strong></p>
<p align="center">
  <a href="https://jenkinsrobotics.github.io/JaegerAvatar/">Project website</a> ·
  <a href="dev/docs/vision/PRODUCT_SCOPE.md">Product scope</a> ·
  <a href="dev/docs/roadmap/README.md">Roadmap</a> ·
  <a href="LICENSE">Apache-2.0</a>
</p>

> **Early development.** This repository currently contains the product documentation,
> an interactive project website and retained application-template references.
> The avatar application, embedded agent, pack editor and JaegerAI connection are
> **planned**, not installed or runnable here yet. See [current status](dev/docs/reality/STATUS.md).

## What is Jaeger Avatar?

Jaeger Avatar is a planned standalone application for creating, customizing and
interacting with animated AI characters. Configure a character's appearance,
expressions, gestures, personality and voice; save it as a portable character
pack; then bring it into a conversation or a performance.

An **avatar** is the visual representation. A **character** combines that
representation with identity and behavior defaults. An **agent instance** is a
running assistant with its own conversation, memory, tools and permissions.
These are separate objects: sharing a character does not share private memories.

## Planned experience

- **Create a character:** identity, personality, backstory and voice preferences.
- **Configure its appearance:** import or customize 2D, 3D or procedural assets;
  map expressions, gaze, mouth shapes and gestures. Full model sculpting is not
  an initial milestone.
- **Save a portable pack:** assets, declared controls, reusable clips and optional
  persona defaults. Credentials and conversation state stay with the runtime.
- **Talk and interact:** host JaegerAgent inside the standalone app, with speech
  and animation synchronized to the active conversation.
- **Connect an existing assistant:** use Avatar as the animated interface for a
  JaegerAI instance while that instance retains memory, permissions and tools.
- **Perform in other modes:** human puppeteering and scripted playback, with
  recording and streaming outputs in later milestones.

A character pack does not require an agent. A person, a script or an AI can drive
its declared controls. The default product experience will be conversational.

## Where it fits

| Project | Responsibility |
| --- | --- |
| **Jaeger Avatar** | Character creation/customization, rendering and the avatar interaction experience. |
| [JaegerAgent](https://github.com/JenkinsRobotics/jaeger-agent) | Reusable headless agent engine: models, turns, tools, skills and multimodal processing. Planned embedded runtime for Avatar. |
| [JaegerAI](https://github.com/JenkinsRobotics/JaegerAI) | Complete general-purpose assistant application. Avatar can become an optional interface for an existing instance. |
| [JaegerOS](https://github.com/JenkinsRobotics/JaegerOS) | Runtime composition, messaging, modules, supervision and capability contracts. |
| [JaegerAnimation](https://github.com/JenkinsRobotics/JaegerAnimation) | Reusable raster/media playback and the existing `character/v1` loader. |
| [Mochi](https://github.com/JenkinsRobotics/Mochi) | Character and virtual-robot workbench for proving runtime capabilities intended for JP01. |
| [Aether Animation](https://github.com/JenkinsRobotics/Aether-Animation) | Physical mechanisms, animatronics, rig control and digital-twin development. |

**Standalone mode (planned):** Avatar hosts JaegerAgent and owns the session's
configuration and storage. JaegerAI is not a required second application.

**Connected mode (planned):** JaegerAI owns the assistant session; Avatar renders
and voices that session through an explicit client adapter. It does not create
an additional agent or independent memory for the same conversation.

The pack format and visual integration require compatibility work. Existing
JaegerAI personas, Mochi packs and Aether formats are not automatically interchangeable.
See [architecture](dev/docs/vision/ARCHITECTURE.md).

## Development

There is no application installer or launch command yet. To preview the project
website, using Python 3:

```sh
git clone https://github.com/JenkinsRobotics/JaegerAvatar.git
cd JaegerAvatar
python3 scripts/check_site.py
python3 -m http.server 8898 --bind 127.0.0.1 --directory docs
```

Open [the local website](http://127.0.0.1:8898/). Its expression sketch runs in the
browser without a model, microphone or account; it is an illustration of the
control concept, not the finished avatar runtime.

- [Documentation map](dev/docs/README.md)
- [Product scope](dev/docs/vision/PRODUCT_SCOPE.md)
- [Architecture and integration](dev/docs/vision/ARCHITECTURE.md)
- [Milestones](dev/docs/roadmap/README.md)
- [GitHub Pages publishing](docs/SITE.md)
- [Contributor conventions](CONVENTIONS.md)

The inherited `workspace/`, `examples/`, `{{package_name}}/` and
`pyproject.toml.example` are retained template references. They are not an
implemented Jaeger Avatar package. Runtime packaging and dependency pins will
be selected and verified during implementation.

## License

[Apache License 2.0](LICENSE). Original character assets and imported models
retain their own licenses and attribution.
