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
import bigdecimal from 'bigdecimal';
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);
const SAROS_SWAP_PROGRAM_ADDRESS_V1 = new PublicKey(
  'SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr'
);

const FEE_OWNER = 'FDbLZ5DRo61queVRH9LL1mQnsiAoubQEnoCRuPEmH9M8';
const mintAddressUsdt = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const mintAddressUsdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SLIPPAGE = 0.5;
const connection = new Connection('https://orca.rpcpool.com/');
const accountSol = '5UrM9csUEDBeBqMZTuuZyHRNhbRW4vQ1MgKJDrKU1U2v'; // address wallet Sol

// example pool saros C98 to USDC

const USDC_TOKEN = {
  id: 'usd-coin',
  mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'usdc',
  name: 'USD Coin',
  icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042389',
  decimals: '6',
  addr: 'FXRiEosEvHnpc3XZY1NS7an2PB1SunnYW1f5zppYhXb3',
};

const C98_TOKEN = {
  id: 'coin98',
  mintAddress: 'C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9',
  symbol: 'C98',
  name: 'Coin98',
  icon: 'https://coin98.s3.amazonaws.com/TVF7VPTqpm6bmDqg',
  decimals: '6',
  addr: 'EKCdCBjfQ6t5FBfDC2zvmr27PgfVVZU37C8LUE4UenKb',
};

const poolParams = {
  address: '2wUvdZA8ZsY714Y5wUL9fkFmupJGGwzui2N74zqJWgty',
  tokens: {
    C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9: {
      ...C98_TOKEN,
    },
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
      ...USDC_TOKEN,
    },
  },
  tokenIds: [
    'C98A4nkJXhpVZNAZdHUA95RpTF3T4whtQubL3YobiUX9',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ],
};

const convertBalanceToWei = (strValue, iDecimal = 18) => {
  try {
    const multiplyNum = new bigdecimal.BigDecimal(Math.pow(10, iDecimal));
    const convertValue = new bigdecimal.BigDecimal(String(strValue));
    return multiplyNum.multiply(convertValue).toString().split('.')[0];
  } catch (err) {
    return 0;
  }
};

const handleSwap = async () => {
  const fromTokenAccount = C98_TOKEN.addr;
  const toTokenAccount = USDC_TOKEN.addr;
  const fromMint = C98_TOKEN.mintAddress;
  const toMint = USDC_TOKEN.mintAddress;
  const fromAmount = 1;
  // getSwapAmountSaros to calculate output pool saros
  const estSwap = await sarosSdk.getSwapAmountSaros(
    connection,
    fromMint,
    toMint,
    fromAmount,
    SLIPPAGE,
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
  return `txs success hash to scan ${result.hash}`;
};

const handleCreatePool = async () => {
  const token0Mint = USDC_TOKEN.mintAddress;
  const token1Mint = C98_TOKEN.mintAddress;
  const token0Account = USDC_TOKEN.addr;
  const token1Account = C98_TOKEN.addr;
  const isStableCoin =
    (token0Mint === mintAddressUsdt && token1Mint === mintAddressUsdc) ||
    (token0Mint === mintAddressUsdc && token1Mint === mintAddressUsdt);

  const curveType = isStableCoin ? 1 : 0;
  const curveParameter = isStableCoin ? 1 : 0;
  const convertFromAmount = convertBalanceToWei(1, USDC_TOKEN.decimals);
  const convertToAmount = convertBalanceToWei(1, C98_TOKEN.decimals);
  const response = await sarosSdk.createPool(
    connection,
    accountSol,
    new PublicKey(FEE_OWNER),
    new PublicKey(token0Mint),
    new PublicKey(token1Mint),
    new PublicKey(token0Account),
    new PublicKey(token1Account),
    convertFromAmount,
    convertToAmount,
    curveType,
    new BN(curveParameter),
    TOKEN_PROGRAM_ID,
    SAROS_SWAP_PROGRAM_ADDRESS_V1
  );

  console.log({ response });
};

const handleAddLiquidPool = async () => {
  const poolAccountInfo = await sarosSdk.getPoolInfo(
    connection,
    new PublicKey(poolParams.address)
  );
  const token0Mint = C98_TOKEN.mintAddress;
  const token1Mint = USDC_TOKEN.mintAddress;
  const token0Account = C98_TOKEN.addr;
  const token1Account = USDC_TOKEN.addr;
  const newPoolLpMintInfo = await sarosService.getTokenMintInfo(
    connection,
    poolAccountInfo.lpTokenMint
  );
  const lpTokenSupply = newPoolLpMintInfo.supply
    ? newPoolLpMintInfo.supply.toNumber()
    : 0;
  const convertFromAmount = convertBalanceToWei(1, USDC_TOKEN.decimals);
  const newPoolToken0AccountInfo = await sarosService.getTokenAccountInfo(
    connection,
    poolAccountInfo.token0Account
  );
  const lpTokenAmount =
    (parseFloat(convertFromAmount) * lpTokenSupply) /
    newPoolToken0AccountInfo.amount.toNumber();

  const result = await sarosSdk.depositAllTokenTypes(
    connection,
    accountSol,
    new PublicKey(accountSol),
    new PublicKey(token0Account),
    new PublicKey(token1Account),
    lpTokenAmount,
    new PublicKey(poolParams.address),
    SAROS_SWAP_PROGRAM_ADDRESS_V1,
    token0Mint,
    token1Mint,
    SLIPPAGE
  );

  console.log({ result });
};

const handleWithdraw = async () => {
  const poolAccountInfo = await sarosSdk.getPoolInfo(
    connection,
    new PublicKey(poolParams.address)
  );
  const lpTokenSupply = poolAccountInfo.supply
    ? poolAccountInfo.supply.toNumber()
    : 0;
  const lpTokenMint = poolAccountInfo.lpTokenMint.toString();
  const newPoolToken0AccountInfo = await sarosService.getTokenAccountInfo(
    connection,
    poolAccountInfo.token0Account
  );
  const lpTokenAmount =
    (parseFloat(1) * lpTokenSupply) /
    newPoolToken0AccountInfo.amount.toNumber();
  const infoLpUser = await sarosService.getInfoTokenByMint(
    lpTokenMint,
    accountSol
  );
  const token0Mint = C98_TOKEN.mintAddress;
  const token1Mint = USDC_TOKEN.mintAddress;
  const token0Account = C98_TOKEN.addr;
  const token1Account = USDC_TOKEN.addr;
  const result = await sarosSdk.withdrawAllTokenTypes(
    connection,
    accountSol,
    infoLpUser.pubkey,
    token0Account,
    token1Account,
    lpTokenAmount,
    new PublicKey(poolParams.address),
    SAROS_SWAP_PROGRAM_ADDRESS_V1,
    token0Mint,
    token1Mint,
    SLIPPAGE
  );
  const { isError } = result;
  if (isError) {
    return console.log(`${result.mess}`);
  }
  return `txs success hash to scan ${result.hash}`;
};
```
