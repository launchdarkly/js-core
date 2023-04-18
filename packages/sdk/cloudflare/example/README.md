## Test data

To insert test data to the preview environment:

```shell
# The Cloudflare SDK automatically adds the "LD-Env-" prefix to your sdk key
wrangler kv:key put --binding=LD_KV "LD-Env-test-sdk-key" --path ./src/testData.json --preview
```

Then to view that test data:

```shell
wrangler kv:key get --binding=LD_KV "LD-Env-test-sdk-key" --preview
```
