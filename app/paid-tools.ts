import {getCalendarAccess} from './calendar-access';
import {getPremiumProgram} from './premium-access';
import {hasPaidTools,PREMIUM_MESSAGE} from '../vercel-proxy/premium-policy.mjs';
export async function paidToolsAccess(email:string){
  const [calendarAccess,premiumProgram]=await Promise.all([getCalendarAccess(email),getPremiumProgram(email)]);
  return hasPaidTools({calendarAccess,premiumProgram});
}
export async function requirePaidTools(email:string){
  if(!await paidToolsAccess(email))throw new Error(PREMIUM_MESSAGE);
}
