# sarosSwap

Saros Swap

# Installation

Use your environment's package manager to install saros-sdk into your project.

```bash
yarn add saros-sdk
```

```bash
npm install saros-sdk
```

# Usage

```javascript
import sarosSdk from 'saros-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

const SAROS_SWAP_PROGRAM_ADDRESS_V1 = new PublicKey(
  'SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr'
);

const handleSwap = async () => {
  // example pool saros C98 to USDC
  const poolParams = {
    address: '2wUvdZA8ZsY714Y5wUL9fkFmupJGGwzui2N74zqJWgty',
    tokens: {
      C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9: {
        id: 'coin98',
        mintAddress: 'C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9',
        symbol: 'C98',
        name: 'Coin98',
        icon: 'https://coin98.s3.amazonaws.com/TVF7VPTqpm6bmDqg',
        decimals: '6',
        addr: 'EKCdCBjfQ6t5FBfDC2zvmr27PgfVVZU37C8LUE4UenKb',
      },
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
        id: 'usd-coin',
        mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'usdc',
        name: 'USD Coin',
        icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042389',
        decimals: '6',
        addr: 'FXRiEosEvHnpc3XZY1NS7an2PB1SunnYW1f5zppYhXb3',
      },
    },
    tokenIds: [
      'C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ],
  };

  //address wallet Sol
  const accountSol = '5UrM9csUEDBeBqMZTuuZyHRNhbRW4vQ1MgKJDrKU1U2v';
  const connection = new Connection('https://orca.rpcpool.com/');
  const fromTokenAccount = 'EKCdCBjfQ6t5FBfDC2zvmr27PgfVVZU37C8LUE4UenKb';
  const toTokenAccount = 'FXRiEosEvHnpc3XZY1NS7an2PB1SunnYW1f5zppYhXb3';
  const fromMint = 'C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9';
  const toMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const fromAmount = 1;
  // getSwapAmountSaros to calculate output pool saros
  const estSwap = await sarosSdk.getSwapAmountSaros(
    connection,
    fromMint,
    toMint,
    fromAmount,
    0.5,
    poolParams
  );
  const { amountOutWithSlippage } = estSwap;
  const result = await sarosSdk.swapSaros(
    connection,
    fromTokenAccount.toString(),
    toTokenAccount.toString(),
    parseFloat(fromAmount),
    parseFloat(amountOutWithSlippage),
    null,
    new PublicKey(poolParams.address),
    SAROS_SWAP_PROGRAM_ADDRESS_V1,
    accountSol,
    fromMint,
    toMint
  );
  const { isError } = result;
  if (isError) {
    return console.log(`${result.mess}`);
  }
  return `txs success hash to scan ${result.hash}`
};
```
