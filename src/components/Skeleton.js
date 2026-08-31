export function Skeleton({ width, height, className = "", style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || "100%",
        height: height || "20px",
        ...style,
      }}
    />
  );
}
