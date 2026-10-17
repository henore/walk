import {NativeModules, NativeEventEmitter, Platform} from 'react-native';
import {getProStatus, setProStatus} from './walkStorage';

const {BillingModule} = NativeModules;

let emitter: NativeEventEmitter | null = null;

export async function initBilling(): Promise<boolean> {
  if (Platform.OS !== 'android' || !BillingModule) return false;
  try {
    await BillingModule.initConnection();
    emitter = new NativeEventEmitter(BillingModule);
    return true;
  } catch {
    return false;
  }
}

export async function purchasePro(): Promise<boolean> {
  if (!BillingModule) return false;
  try {
    const result = await BillingModule.purchasePro();
    if (result) {
      await setProStatus(true);
    }
    return !!result;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!BillingModule) return false;
  try {
    const result = await BillingModule.restorePurchases();
    if (result) {
      await setProStatus(true);
    }
    return !!result;
  } catch {
    return false;
  }
}

export async function checkAndRestorePro(): Promise<boolean> {
  const local = await getProStatus();
  if (local) return true;
  if (!BillingModule) return false;
  try {
    await BillingModule.initConnection();
    const result = await BillingModule.restorePurchases();
    if (result) {
      await setProStatus(true);
      return true;
    }
  } catch {}
  return false;
}

export async function endBilling(): Promise<void> {
  if (!BillingModule) return;
  try {
    await BillingModule.endConnection();
  } catch {}
  emitter = null;
}
