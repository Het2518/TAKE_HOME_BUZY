export function Skeleton({ width = "100%", height = "20px", className = "", style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}
