import MultiEventSummarizer from "./MultiEventSummarizer";
import InputEvalEvent from "./InputEvalEvent";
import Context from "../../Context";
import InputIdentifyEvent from "./InputIdentifyEvent";
import { setupCrypto } from "../../../__tests__/setupCrypto";
import ContextFilter from "../../ContextFilter";

describe("with mocked crypto and hasher", () => {
  let summarizer: MultiEventSummarizer;

  beforeEach(() => {
    const crypto = setupCrypto();
    const contextFilter = new ContextFilter(false, []);
    summarizer = new MultiEventSummarizer(crypto, contextFilter);
  });

  test("creates new summarizer for new context hash", async () => {
    const context = Context.fromLDContext({ kind: "user", key: "user1" });
    const event = new InputEvalEvent(
      true,
      context,
      "flag-key",
      "value",
      "default",
      1,
      0,
      true
    );

    summarizer.summarizeEvent(event);
    await new Promise(process.nextTick); // Wait for async operations

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  test("uses existing summarizer for same context hash", async () => {
    const context = Context.fromLDContext({ kind: "user", key: "user1" });
    const event1 = new InputEvalEvent(
      true,
      context,
      "flag-key",
      "value1",
      "default",
      1,
      0,
      true
    );
    const event2 = new InputEvalEvent(
      true,
      context,
      "flag-key",
      "value2",
      "default",
      1,
      0,
      true
    );

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);
    await new Promise(process.nextTick);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(1);
  });

  test("ignores non-feature events", async () => {
    const context = Context.fromLDContext({ kind: "user", key: "user1" });
    const event = new InputIdentifyEvent(context);

    summarizer.summarizeEvent(event);
    await new Promise(process.nextTick);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(0);
  });

  test("handles multiple different contexts", async () => {
    const context1 = Context.fromLDContext({ kind: "user", key: "user1" });
    const context2 = Context.fromLDContext({ kind: "user", key: "user2" });
    const event1 = new InputEvalEvent(
      true,
      context1,
      "flag-key",
      "value1",
      "default",
      1,
      0,
      true
    );
    const event2 = new InputEvalEvent(
      true,
      context2,
      "flag-key",
      "value2",
      "default",
      1,
      0,
      true
    );

    summarizer.summarizeEvent(event1);
    summarizer.summarizeEvent(event2);
    await new Promise(process.nextTick);

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(2);
  });

  test("clears all summarizers", async () => {
    const context = Context.fromLDContext({ kind: "user", key: "user1" });
    const event = new InputEvalEvent(
      true,
      context,
      "flag-key",
      "value",
      "default",
      1,
      0,
      true
    );

    summarizer.summarizeEvent(event);
    await new Promise(process.nextTick);
    summarizer.clearSummary();

    const summaries = summarizer.getSummaries();
    expect(summaries).toHaveLength(0);
  });
}); 
