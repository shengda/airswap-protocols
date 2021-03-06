/*
  Copyright 2020 Swap Holdings Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as ethUtil from 'ethereumjs-util'
import { ethers } from 'ethers'
import { signatureTypes, SECONDS_IN_DAY, tokenKinds } from '@airswap/constants'
import {
  Quote,
  UnsignedOrder,
  Order,
  Signature,
  emptyOrderParty,
} from '@airswap/types'
import { getOrderHash } from './hashes'
import { lowerCaseAddresses } from '..'

export function createOrder({
  expiry = Math.round(Date.now() / 1000 + SECONDS_IN_DAY).toString(),
  nonce = Date.now(),
  signer = {},
  sender = {},
  affiliate = {},
}): UnsignedOrder {
  return lowerCaseAddresses({
    expiry: String(expiry),
    nonce: String(nonce),
    signer: { ...emptyOrderParty, ...signer },
    sender: { ...emptyOrderParty, ...sender },
    affiliate: { ...emptyOrderParty, ...affiliate },
  })
}

export function createOrderForQuote(
  quote: Quote,
  signerWallet: string,
  senderWallet: string
): UnsignedOrder {
  return createOrder({
    signer: {
      kind: tokenKinds.ERC20,
      token: quote.signer.token,
      amount: quote.signer.amount,
      wallet: signerWallet,
    },
    sender: {
      kind: tokenKinds.ERC20,
      token: quote.sender.token,
      amount: quote.sender.amount,
      wallet: senderWallet,
    },
  })
}

export async function createSignature(
  order: UnsignedOrder,
  wallet: ethers.Wallet,
  swapContract: string
): Promise<Signature> {
  const orderHash = getOrderHash(order, swapContract)
  const signedMsg = await wallet.signMessage(ethers.utils.arrayify(orderHash))
  const sig = ethers.utils.splitSignature(signedMsg)
  const { r, s, v } = sig

  return {
    signatory: (await wallet.getAddress()).toLowerCase(),
    validator: swapContract,
    version: signatureTypes.PERSONAL_SIGN,
    v: String(v),
    r,
    s,
  }
}

export async function signOrder(
  order: UnsignedOrder,
  wallet: ethers.Wallet,
  swapContract: string
): Promise<Order> {
  return {
    ...order,
    signature: await createSignature(order, wallet, swapContract),
  }
}

export function hasValidSignature(order) {
  const signature = order['signature']
  let orderHash = getOrderHash(order, signature['validator'])
  if (signature.version === '0x45') {
    const prefix = Buffer.from('\x19Ethereum Signed Message:\n')
    orderHash = ethUtil.keccak256(
      Buffer.concat([prefix, Buffer.from(String(orderHash.length)), orderHash])
    )
  }
  let signingPubKey
  try {
    signingPubKey = ethUtil.ecrecover(
      orderHash,
      signature['v'],
      signature['r'],
      signature['s']
    )
  } catch (e) {
    return false
  }
  const signingAddress = ethUtil.bufferToHex(
    ethUtil.pubToAddress(signingPubKey)
  )
  return signingAddress.toLowerCase() === signature['signatory']
}

export function isValidOrder(order: Order): boolean {
  if (
    order &&
    'nonce' in order &&
    'expiry' in order &&
    'signer' in order &&
    'sender' in order &&
    'affiliate' in order &&
    'signature' in order &&
    'wallet' in order['signer'] &&
    'wallet' in order['sender'] &&
    'wallet' in order['affiliate'] &&
    'token' in order['signer'] &&
    'token' in order['sender'] &&
    'token' in order['affiliate'] &&
    'amount' in order['signer'] &&
    'amount' in order['sender'] &&
    'amount' in order['affiliate'] &&
    'id' in order['signer'] &&
    'id' in order['sender'] &&
    'id' in order['affiliate'] &&
    'signatory' in order['signature'] &&
    'validator' in order['signature'] &&
    'r' in order['signature'] &&
    's' in order['signature'] &&
    'v' in order['signature']
  ) {
    return hasValidSignature(order)
  }
  return false
}
