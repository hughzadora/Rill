export function Card({ title }: { title: string }) {
  return (
    <article className="foo bar p-4 px-2">
      <h2>{title}</h2>
    </article>
  );
}
