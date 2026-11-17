import React, { useMemo } from 'react';
import QRCode from 'qrcode';
import { formatCurrency, GCASH_ACCOUNT } from '../data/courts';

interface GCashQRCodeProps {
  amount: number;
  bookingId: string;
  courtName: string;
  date: string;
}

export const GCashQRCode: React.FC<GCashQRCodeProps> = ({
  amount,
  bookingId,
  courtName,
  date
}) => {
  const qrMatrix = useMemo(() => {
    const payload = [
      'GCASH-PAY',
      `MERCHANT:${GCASH_ACCOUNT.accountName}`,
      `NO:${GCASH_ACCOUNT.accountNumber.replace(/-/g, '')}`,
      `AMT:${amount}`,
      `REF:${bookingId}`,
      `COURT:${courtName}`,
      `DATE:${date}`
    ].join('|');

    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const rects: string[] = [];

    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (data[r * size + c]) {
          rects.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }

    return {
      size,
      pathData: rects.join('')
    };
  }, [amount, bookingId, courtName, date]);

  const quietZone = 2;
  const viewBoxSize = qrMatrix.size + quietZone * 2;

  return (
    <div className="bg-white border border-pink-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center">
      <div className="flex items-center justify-between w-full mb-3 pb-2.5 border-b border-pink-100">
        <span className="text-xs font-semibold text-[#831843]">GCash QR Payment</span>
        <span className="font-mono text-xs font-bold text-[#BE185D] tabular-nums">
          {formatCurrency(amount)}
        </span>
      </div>

      <div className="p-3 bg-white rounded-xl border border-pink-100 shadow-xs">
        <svg
          width="192"
          height="192"
          viewBox={`-${quietZone} -${quietZone} ${viewBoxSize} ${viewBoxSize}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`GCash QR code for ${formatCurrency(amount)} to ${GCASH_ACCOUNT.accountName}`}
          className="w-44 h-44 sm:w-48 sm:h-48"
        >
          <rect
            x={-quietZone}
            y={-quietZone}
            width={viewBoxSize}
            height={viewBoxSize}
            fill="#FFFFFF"
          />
          <path d={qrMatrix.pathData} fill="#1E1B18" />
        </svg>
      </div>

      <p className="mt-3 text-xs font-semibold text-[#831843]">{GCASH_ACCOUNT.accountName}</p>
      <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
        {GCASH_ACCOUNT.accountNumber}
      </p>
      <p className="mt-1 text-[11px] text-pink-900/70">
        Scan QR with your GCash app or send directly to the number above
      </p>
    </div>
  );
};
