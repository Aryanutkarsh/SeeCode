# Security Policy

## Supported versions

Security fixes go into the latest release and the `main` branch. Older releases don't receive backports, so please update before reporting if you can.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/Aryanutkarsh/seecode/security/advisories/new). Please don't describe a suspected vulnerability in a public issue, pull request, discussion or social-media post until a fix is out.

Include what you can of:

- the SeeCode version or commit, how you installed it (plugin, skills.sh, zip, clone), your OS, Node version and agent host;
- the affected command, file or component, such as `render`, `import`, `scan`, `export`, the viewer, or a release workflow;
- what an attacker could do, and under what conditions;
- a minimal reproduction, such as a spec, an imported file or a generated HTML file;
- a suggested fix, if you have one.

Redact secrets, tokens, private repository content and personal data from anything you send.

## What counts

Areas where a report is especially valuable:

- **Untrusted input.** Spec labels, imported files (Mermaid, draw.io, SQL and the other formats) and scanned repositories are treated as data. Anything that leads to script execution in a generated HTML file, file writes outside the output location, or command execution is a vulnerability.
- **Generated files.** A SeeCode HTML file should run only its own viewer code, and load only Google Fonts and, for in-page GIF/MP4 export, the encoder modules from jsDelivr.
- **Export.** The CLI starts a headless browser on local files. Anything that lets diagram content reach beyond that is in scope.
- **Brand onboarding.** `brand <url>` fetches a page and up to six stylesheets you name, and reads them as text for colours. Anything that makes it execute content, fetch beyond that, or write anything but the profile is in scope.
- **Supply chain.** The release workflow, the published `seecode.zip`, the plugin manifests and the bundled encoders in `skills/seecode/scripts/vendor/`.

Diagrams that look wrong, crashes on malformed input with no security impact, and requests for new features are ordinary bugs: please open an issue.

## What to expect

We aim to acknowledge reports within a few days, then confirm the issue, work out its scope and agree on a disclosure timeline with you. You'll be credited in the advisory unless you'd rather not be.

## Good-faith research

Test only against your own installations and files. Don't access or change data that isn't yours, and don't disrupt services or other users. If a test could affect anyone else, stop and report privately first.

Thank you for helping keep SeeCode and its users safe.
