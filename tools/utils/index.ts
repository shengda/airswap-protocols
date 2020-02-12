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
import { ethers } from 'ethers'
import { BigNumber } from 'ethers/utils'
import * as url from 'url'
import {
  defaults,
  signatureTypes,
  SECONDS_IN_DAY,
  tokenKinds,
} from '@airswap/constants'
import { hashes } from '@airswap/order-utils'
import { Quote, Order, SignedOrder } from '@airswap/ts'

function lowerCaseAddresses(obj: any): any {
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      lowerCaseAddresses(obj[key])
    }
    if (typeof obj[key] === 'string' && obj[key].indexOf('0x') === 0) {
      obj[key] = obj[key].toLowerCase()
    }
  }
  return obj
}

export function createOrder({
  expiry = Math.round(Date.now() / 1000 + SECONDS_IN_DAY).toString(),
  nonce = Date.now(),
  signer = defaults.Party,
  sender = defaults.Party,
  affiliate = defaults.Party,
}): Order {
  return lowerCaseAddresses({
    expiry: String(expiry),
    nonce: String(nonce),
    signer: { ...defaults.Party, ...signer },
    sender: { ...defaults.Party, ...sender },
    affiliate: { ...defaults.Party, ...affiliate },
  })
}

export function createOrderForQuote(
  quote: Quote,
  signerWallet: string,
  senderWallet: string
): Order {
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

export async function signOrder(
  order: Order,
  signer: ethers.Signer,
  swapContract: string
): Promise<SignedOrder> {
  const orderHash = hashes.getOrderHash(order, swapContract)
  const signedMsg = await signer.signMessage(ethers.utils.arrayify(orderHash))
  const sig = ethers.utils.splitSignature(signedMsg)
  const { r, s, v } = sig

  return {
    ...order,
    signature: {
      signatory: (await signer.getAddress()).toLowerCase(),
      validator: swapContract,
      version: signatureTypes.PERSONAL_SIGN,
      v: String(v),
      r,
      s,
    },
  }
}

export function parseUrl(locator: string): url.UrlWithStringQuery {
  if (!/^http:\/\//.test(locator) && !/^https:\/\//.test(locator)) {
    locator = `https://${locator}`
  }
  return url.parse(locator)
}

export function toDecimalString(
  value: string | BigNumber,
  decimals: string | number
): string {
  return ethers.utils.formatUnits(value.toString(), decimals).toString()
}

export function toAtomicString(
  value: string | BigNumber,
  decimals: string | number
): string {
  return ethers.utils.parseUnits(value.toString(), decimals).toString()
}
