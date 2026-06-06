import { Box } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';

/** Deterministic hue from a string so each title gets a stable colour. */
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * A generated gradient "cover" standing in for real cover art (which catalog-service
 * will own later). Stable per title, with the title overlaid.
 */
export function BookCover({
  title,
  height = 180,
  showTitle = true,
}: {
  title: string;
  height?: number;
  showTitle?: boolean;
}) {
  const h1 = hashHue(title);
  const h2 = (h1 + 45) % 360;
  return (
    <Box
      sx={{
        height,
        borderRadius: 2,
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        p: 1.5,
        color: '#fff',
        overflow: 'hidden',
        background: `linear-gradient(135deg, hsl(${h1} 62% 52%), hsl(${h2} 68% 38%))`,
      }}
    >
      <MenuBookIcon sx={{ position: 'absolute', top: 12, right: 12, opacity: 0.35, fontSize: 28 }} />
      {showTitle && (
        <Box
          sx={{
            fontWeight: 700,
            fontSize: height > 220 ? 22 : 15,
            lineHeight: 1.2,
            textShadow: '0 1px 6px rgba(0,0,0,0.35)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </Box>
      )}
    </Box>
  );
}
