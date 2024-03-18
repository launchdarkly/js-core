import { integrations } from '@launchdarkly/js-server-sdk-common';

// This file should be reconsidered on a major version as it does not export
// every integration type. It just exports the implementations.

const { FileDataSourceFactory, TestData, TestDataFlagBuilder, TestDataRuleBuilder } = integrations;

export { FileDataSourceFactory, TestData, TestDataFlagBuilder, TestDataRuleBuilder };
