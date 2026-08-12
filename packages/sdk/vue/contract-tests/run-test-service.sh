#!/bin/bash

yarn workspace @launchdarkly/vue-contract-test-service run start:adapter & yarn workspace @launchdarkly/vue-contract-test-service run start && kill $!
