/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-undef */
import {
  PublicKey,
  Transaction,
  Connection,
  SystemProgram,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  AccountLayout,
  u64,
} from '@solana/spl-token';
import { convertWeiToBalance, sleep } from '../functions';
import * as BufferLayout from 'buffer-layout';
import { get } from 'lodash';

const bs58 = require('bs58');
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const NATIVE_SOL = {
  id: 'solana',
  mintAddress: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  icon: 'https://cdn.jsdelivr.net/gh/trustwallet/assets/blockchains/solana/info/logo.png',
  decimals: 9,
};

const txsFail = 'txsFail';
export const messFail = [
  'gasSolNotEnough',
  'tradeErrFund',
  'sizeTooSmall',
  'txsFail',
  'tooLarge',
  'exceedsLimit',
];

async function findProgramAddress(seeds, programId) {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(
    seeds,
    programId
  );
  return { publicKey, nonce };
}

export async function awaitTransactionSignatureConfirmation(
  connection,
  txid,
  timeout = 20000
) {
  let done = false;
  const connectionOrca = genConnectionSolana();
  const result = await new Promise((resolve, reject) => {
    (async () => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        console.log('Timed out for txid', txid);
        const timeout = { timeout: true };
        reject(timeout);
      }, timeout);
      try {
        connectionOrca.onSignature(
          txid,
          (result) => {
            done = true;

            if (result.err) {
              const isExceedsLimit =
                get(result.err, 'InstructionError[1].Custom', 0) === 30 ||
                get(result.err, 'InstructionError[1].Custom', 0) === 16;
              const isNotEnoughSol =
                get(result.err, 'InstructionError[1].Custom', 0) === 1;
              done = true;
              if (isNotEnoughSol) {
                reject({
                  isError: true,
                  mess: isNotEnoughSol ? 'Error gasSolNotEnough' : txsFail,
                });
              }
              reject({
                isError: true,
                mess: isExceedsLimit ? 'Error exceedsLimit' : txsFail,
              });
            } else {
              resolve(result);
            }
          },
          'recent'
        );
      } catch (e) {
        done = true;
        console.log('WS error in setup', txid, e);
      }
      while (!done) {
        (async () => {
          try {
            const signatureStatuses = await connectionOrca.getSignatureStatuses(
              [txid]
            );
            const result = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!result) {
                console.log('REST null result for', txid, result);
              } else if (result.err) {
                const isExceedsLimit =
                  get(result.err, 'InstructionError[1].Custom', 0) === 30 ||
                  get(result.err, 'InstructionError[1].Custom', 0) === 16;
                const isNotEnoughSol =
                  get(result.err, 'InstructionError[1].Custom', 0) === 1;
                done = true;
                if (isNotEnoughSol) {
                  reject({
                    isError: true,
                    mess: isNotEnoughSol ? 'Error gasSolNotEnough' : txsFail,
                  });
                }
                reject({
                  isError: true,
                  mess: isExceedsLimit ? 'Error exceedsLimit' : txsFail,
                });
              } else if (!result.confirmations) {
                done = true;
                resolve(result);
              } else {
                done = true;
                resolve(result);
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e);
            }
          }
        })();
        await sleep(300);
      }
    })();
  });
  done = true;
  return result;
}

export function encodeMessErr(mess) {
  const stringResult = mess ? get(mess, 'mess', mess).toString() : '';

  if (stringResult.includes('Error')) {
    let mess = txsFail;
    switch (true) {
      case stringResult.includes('exceedsLimit'):
        mess = 'exceedsLimit';
        break;
      // case stringResult.includes('gasSolNotEnough'):
      //   mess = 'gasSolNotEnough';
      //   break;
      case stringResult.includes('Insufficient funds'):
        mess = 'tradeErrFund';
        break;
      case stringResult.includes('size too small'):
        mess = 'sizeTooSmall';
        break;
      case stringResult.includes('Transaction too large'):
        mess = 'tooLarge';
        break;
      case stringResult.includes('Attempt to debit an account but'):
      case stringResult.includes('gasSolNotEnough'):
      case stringResult.includes('0x1'):
        mess = 'gasSolNotEnough';
        break;
      // case stringResult.includes('0x1'):
      //   mess = 'gasSolNotEnough';
      //   break;
      case stringResult.includes('the capitalization checksum'):
        mess = null;
        break;
    }
    return mess;
  } else {
    return txsFail;
  }
}

async function findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
  const { publicKey } = await findProgramAddress(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return publicKey;
}

const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'));
LAYOUT.addVariant(
  0,
  BufferLayout.struct([
    BufferLayout.u8('decimals'),
    BufferLayout.blob(32, 'mintAuthority'),
    BufferLayout.u8('freezeAuthorityOption'),
    BufferLayout.blob(32, 'freezeAuthority'),
  ]),
  'initializeMint'
);
LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount');
LAYOUT.addVariant(
  3,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'transfer'
);
LAYOUT.addVariant(
  7,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'mintTo'
);
LAYOUT.addVariant(
  8,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'burn'
);

const instructionMaxSpan = Math.max(
  ...Object.values(LAYOUT.registry).map((r) => r.span)
);

export const genConnectionSolana = () => {
  const connectionSolana = new Connection(
    'https://api.mainnet-beta.solana.com',
    'singleGossip'
  );
  return connectionSolana;
};

export async function genOwnerSolana(wallet) {
  const publicKey = new PublicKey(wallet);
  return { publicKey };
}

export async function fetchSPLAccount(wallet, mintAddress) {
  try {
    let address = mintAddress;
    if (mintAddress.toString() === NATIVE_SOL.mintAddress) {
      address = NATIVE_SOL.mintAddress;
    }

    const connection = genConnectionSolana();

    const publicKey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(address);

    const fetchInside = async (isLastFetch) => {
      const accountToken = await connection.getTokenAccountsByOwner(publicKey, {
        mint: mintPubkey,
      });
      if (accountToken && accountToken.value.length > 0) {
        let pubKey = accountToken.value[0].pubkey;

        // Find ata first
        if (accountToken.value.length > 1) {
          const ata = await findAssociatedTokenAddress(publicKey, mintPubkey);
          const findAta = accountToken.value.find((itm) =>
            itm.pubkey.equals(ata)
          );
          pubKey = findAta
            ? findAta.pubkey
            : accountToken.value.sort((a, b) =>
                a.lamports > b.lamports ? -1 : 1
              )[0].pubkey;
        }

        return pubKey;
      } else {
        return '';
      }
    };
    return await fetchInside();
  } catch (error) {
    console.log({ error });
    return '';
  }
}

export async function signTransaction(transaction) {
  return window.coin98.sol
    .request({ method: 'sol_sign', params: [transaction] })
    .then((res) => {
      const sig = bs58.decode(res.signature);
      const publicKey = new PublicKey(res.publicKey);
      transaction.addSignature(publicKey, sig);
      return transaction;
    })
    .catch((err) => {
      console.log({ err });
    });
}

export async function postBaseSendTxs(
  connection,
  transactions,
  signer,
  isWaitDone,
  callBack,
  accountSol
) {
  try {
    const { blockhash } = await connection.getRecentBlockhash();
    let transactionList = new Transaction({ recentBlockhash: blockhash });
    const publicKey = new PublicKey(accountSol);
    transactions
      .filter((t) => t)
      .forEach((t) => {
        transactionList.add(t);
      });
    transactionList.feePayer = publicKey;

    transactionList = await signTransaction(transactionList);
    if (signer.length > 1) {
      const getSignerValid = signer.slice().filter((it) => it.secretKey);
      transactionList.partialSign(...getSignerValid);
    }
    const rawTransaction = transactionList.serialize();
    console.log({ rawTransaction });
    return connection
      .sendRawTransaction(rawTransaction, {
        skipPreflight: false,
      })
      .then(async (hash) => {
        console.log({ hash });
        callBack && callBack();
        if (isWaitDone) {
          await awaitTransactionSignatureConfirmation(connection, hash);
          return hash;
        }

        return hash;
      })
      .catch((mess) => {
        return encodeMessErr(mess);
      });
  } catch (error) {
    console.log({ error });
    return encodeMessErr(error);
  }
}

export async function sendTransaction(
  connection,
  transaction,
  signers = [],
  toastNotiWait
) {
  try {
    transaction = await signTransaction(transaction);
    if (signers.length > 1) {
      const getSignerValid = signers.slice().filter((it) => it.secretKey);
      transaction.partialSign(...getSignerValid);
    }
    const rawTransaction = transaction.serialize();
    const hash = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
    });
    console.log({ hash });

    await awaitTransactionSignatureConfirmation(connection, hash);
    toastNotiWait && toastNotiWait();
    return hash;
  } catch (mess) {
    console.log({ mess });
    return { isError: true, mess: encodeMessErr(mess.mess) };
  }
}

export async function solanaGetBalance(address, contract) {
  if (!address) return 0;
  try {
    const connectionSolana = genConnectionSolana();

    const pubKey = new PublicKey(address);
    if (contract) {
      const tokenInfo = await connectionSolana.getTokenAccountBalance(
        pubKey,
        'recent'
      );

      return tokenInfo?.value?.uiAmount;
    }
    const balance = await connectionSolana.getBalance(pubKey);
    return convertWeiToBalance(balance, 9);
  } catch (error) {
    console.log({ error });
    return 0;
  }
}

export async function findOldTokenAccount(owner, listAccount) {
  const tokenAccounts = {};
  const auxiliaryTokenAccounts = [];
  const publicKey = new PublicKey(owner);
  for (const tokenAccountInfo of listAccount) {
    const tokenAccountPubkey = tokenAccountInfo.pubkey;
    const tokenAccountAddress = tokenAccountPubkey.toBase58();
    const parsedInfo = tokenAccountInfo.account.data.parsed.info;
    const mintAddress = parsedInfo.mint;
    const balance = parsedInfo.tokenAmount.amount;

    const ata = await findAssociatedTokenAddress(
      publicKey,
      new PublicKey(mintAddress)
    );

    if (mintAddress !== 'So11111111111111111111111111111111111111112') {
      if (ata.equals(tokenAccountPubkey)) {
        tokenAccounts[mintAddress] = {
          account: tokenAccountInfo.account,
          pubkey: new PublicKey(tokenAccountAddress),
          tokenAccountAddress,
          balance,
        };
      } else if (parsedInfo && balance > 0) {
        tokenAccountInfo.ata = ata;
        auxiliaryTokenAccounts.push(tokenAccountInfo);
      }
    }
  }

  return { owner, auxiliaryTokenAccounts, tokenAccounts };
}

export const getInfoTokenByMint = async (mintAddress, accountSol) => {
  const connection = genConnectionSolana();
  const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(accountSol),
    {
      mint: new PublicKey(mintAddress),
    },
    'confirmed'
  );
  if (!parsedTokenAccounts) {
    return null;
  }
  return get(parsedTokenAccounts, 'value[0]', null);
};

export async function awaitTransactionSignatureConfirmationUntil20(
  connection,
  txid,
  timeout = 50000,
  poolAddress
) {
  let done = false;
  const result = await new Promise((resolve, reject) => {
    (async () => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        console.log('Timed out for txid', txid);
        const timeout = { timeout: true };
        reject(timeout);
      }, timeout);
      while (!done) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            const result = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!result) {
                console.log('REST null result for', txid, result);
              } else if (result.err) {
                done = true;
                reject(txsFail);
              } else if (result.confirmations >= 28) {
                done = true;
                resolve(result);
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e);
            }
          }
        })();
        await sleep(300);
      }
    })();
  });
  done = true;

  return result;
}

export const createAtaSol = async (connection, owner, transaction, amount) => {
  const mint = new PublicKey(NATIVE_SOL.mintAddress);
  const ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    owner,
    true
  );

  const rent = await Token.getMinBalanceRentForExemptAccount(connection);
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: ata,
      lamports: amount + rent,
    }),
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      ata,
      owner,
      owner
    )
  );

  return ata;
};

export const createAssociatedTokenAccountIfNotExist = async (
  account,
  owner,
  mintAddress,
  transaction,
  atas = []
) => {
  let publicKey;
  if (account) {
    publicKey = new PublicKey(account);
  }
  const mint = new PublicKey(mintAddress);
  const ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    owner,
    true
  );

  if (
    (!publicKey || !ata.equals(publicKey)) &&
    !atas.includes(ata.toBase58())
  ) {
    transaction.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        ata,
        owner,
        owner
      )
    );
    atas.push(ata.toBase58());
  }

  return ata;
};

export const deserializeAccount = (data) => {
  if (data === undefined || data.length === 0) {
    return undefined;
  }

  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new u64(0);
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return accountInfo;
};

export const createTransactions = async (connection, accountSol) => {
  const publicKey = new PublicKey(accountSol);
  const { blockhash } = await connection.getRecentBlockhash();
  const transaction = new Transaction({ recentBlockhash: blockhash });
  transaction.feePayer = publicKey;
  return transaction;
};
