export class SolanaService {
  static async isAddressInUse (connection, address
  ) {
    const programInf = await connection.getAccountInfo(address)
    return programInf !== null
  }
}
