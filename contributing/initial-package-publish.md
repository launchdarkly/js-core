# Initial Package Publishing

1. When publishing a package for the first time, you must complete several steps not part of a typical package release.

2. If you are not releasing a 1.0, then you need to set the `release-as` setting in the `release-please-config.json` to your desired version. 
Release-please will include all conventional commits, but for the initial release, you do not want them, so you should set the `bootstrap-sha` to the current SHA.

```
    "packages/type/my-package": {
      "bump-minor-pre-major": true // Set this if you are releasing a pre 1.0.
      "release-as": 0.1.0 // Set this for a pre 1.0 release.
      "bootstrap-sha": MY_SHA // Set this to the most recent SHA.
    }
```
3. After the release PR is created you will need to manual update the PR it creates to format the changelog as desired. Ensuring the notice is at the top, and adding any language required for the initial release.

4. When you are ready to release, merge the PR. If there are other packages being released, then check to ensure that package is ready to be released.

5. Remove "release-as" and "boostrap-sha" from the `release-please-config.json`.
