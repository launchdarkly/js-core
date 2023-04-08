## Test data

Locally to insert test data:

```shell
wrangler kv:key put --binding=LD_KV "555abcde" --path ./src/mockFlags.json --preview
```

Then to view that test data:

```shell
wrangler kv:key get --binding=LD_KV "555abcde" --preview
```
