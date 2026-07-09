// Build a UPI deep link (BIP-21-style) the payer can open in any UPI app.
// Spec: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
export function buildUpiIntent(opts: {
  payeeVpa: string;
  payeeName?: string | null;
  amountPaise: number;
  note?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('pa', opts.payeeVpa);
  if (opts.payeeName) params.set('pn', opts.payeeName);
  params.set('am', (opts.amountPaise / 100).toFixed(2));
  params.set('cu', 'INR');
  if (opts.note) params.set('tn', opts.note);
  return `upi://pay?${params.toString()}`;
}
