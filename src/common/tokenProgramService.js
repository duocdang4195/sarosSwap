import { PublicKey } from '@solana/web3.js';
import { TokenProgramInstructionService } from './tokenProgramInstructionService.js';
import {
  ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../constants';

export class TokenProgramService {
  static async getTokenAccountInfo(connection, address) {
    const accountInfo = await connection.getAccountInfo(address);
    const data = TokenProgramInstructionService.decodeTokenAccountInfo(
      accountInfo.data
    );
    data.address = address;
    return data;
  }

  static async getTokenMintInfo(connection, address) {
    const accountInfo = await connection.getAccountInfo(address);
    const data = TokenProgramInstructionService.decodeTokenMintInfo(
      accountInfo.data
    );
    data.address = address;
    return data;
  }

  static async findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
    const [address] = await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    );
    return address;
  }
}
