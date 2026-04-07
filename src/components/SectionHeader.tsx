interface SectionHeaderProps {
  title: string;
  accent?: string;
}

export const SectionHeader = ({ title, accent }: SectionHeaderProps) => (
  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
    {title}{' '}
    {accent && <span className="text-pink-300/80">{accent}</span>}
  </h2>
);
