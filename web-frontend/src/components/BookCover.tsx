import { Box } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function BookCover({
  title,
  coverUrl,
  height = 180,
  showTitle = true,
}: {
  title: string;
  coverUrl?: string | null;
  height?: number;
  showTitle?: boolean;
}) {
  if (coverUrl) {
    return (
      <Box
        sx={{
          height,
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'grey.100',
        }}
      >
        <Box
          component="img"
          src={coverUrl}
          alt={title}
          onError={(e) => {
            // Fall back to gradient on broken image
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            if (el.parentElement) el.parentElement.dataset.fallback = 'true';
          }}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </Box>
    );
  }

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
