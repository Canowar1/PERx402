# Command: /build-program

Builds and optionally deploys the Shadow Proxy Anchor program to devnet.

## Steps

1. Run `cd programs && anchor build`
2. Check for compilation errors — if any, invoke anchor-engineer agent to fix
3. Run `anchor test --skip-deploy` to verify LiteSVM tests pass
4. If `--deploy` flag given: run `anchor deploy --provider.cluster devnet`
5. Save deployed program ID to `docs/deployed-addresses.md`
6. Verify program is accessible: `solana program show <PROGRAM_ID> --url devnet`

## Usage

```
/build-program          # build only
/build-program --deploy # build + deploy to devnet
```

## Checks before deploy

- Wallet must be configured: `solana config get`
- Must have enough SOL: minimum 2 SOL for devnet deploy
- Cluster must be devnet — NEVER mainnet-beta

## Output

After successful build, confirm:
- Program size (aim for < 500KB)
- IDL generated at `target/idl/shadow_proxy.json`
- TypeScript types generated at `target/types/shadow_proxy.ts`
