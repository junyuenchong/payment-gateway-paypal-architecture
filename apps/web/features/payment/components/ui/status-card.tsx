/**
 * ------------------------------------------------------
 * Status Card Props
 * ------------------------------------------------------
 */
type StatusCardProps = {
  title: string;
  status: string;
  statusClassName: string;
  description: string;
};

/**
 * ------------------------------------------------------
 * Payment Status Card
 * ------------------------------------------------------
 */
export function StatusCard({
  title,
  status,
  statusClassName,
  description,
}: StatusCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className={`mt-2 font-semibold ${statusClassName}`}>{status}</p>
      <p className="mt-1 text-slate-300">{description}</p>
    </article>
  );
}
