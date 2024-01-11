## Validating SDK packages with the SLSA framework (Supply-chain Levels for Software Artifacts)

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages.

As part of [SLSA requirements for level 3 compliance](https://slsa.dev/spec/v1.0/requirements), LaunchDarkly publishes provenance attestations about our SDK package builds to npm for distribution alongside our packages. 

For npm packages that are published with provenance, npm automatically [validates the authenticity of the package using Sigstore](https://docs.npmjs.com/generating-provenance-statements#about-npm-provenance). 
