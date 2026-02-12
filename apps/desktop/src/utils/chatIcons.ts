import type { LucideIcon } from 'lucide-react';
import {
  Bird,
  Bug,
  Cat,
  Dog,
  Fish,
  Flame,
  Flower2,
  Hand,
  Heart,
  Laugh,
  Leaf,
  Lightbulb,
  PartyPopper,
  Rabbit,
  Smile,
  Sparkles,
  Star,
  Sun,
  ThumbsUp,
} from 'lucide-react';

export interface ChatIconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export const reactionIconOptions: ChatIconOption[] = [
  { id: 'heart', label: 'Heart', Icon: Heart },
  { id: 'like', label: 'Like', Icon: ThumbsUp },
  { id: 'fire', label: 'Fire', Icon: Flame },
  { id: 'party', label: 'Party', Icon: PartyPopper },
  { id: 'sparkle', label: 'Sparkle', Icon: Sparkles },
  { id: 'laugh', label: 'Laugh', Icon: Laugh },
  { id: 'smile', label: 'Smile', Icon: Smile },
  { id: 'idea', label: 'Idea', Icon: Lightbulb },
  { id: 'hand', label: 'Hand', Icon: Hand },
  { id: 'star', label: 'Star', Icon: Star },
];

export const stickerIconOptions: ChatIconOption[] = [
  { id: 'dog', label: 'Dog', Icon: Dog },
  { id: 'cat', label: 'Cat', Icon: Cat },
  { id: 'rabbit', label: 'Rabbit', Icon: Rabbit },
  { id: 'fish', label: 'Fish', Icon: Fish },
  { id: 'bird', label: 'Bird', Icon: Bird },
  { id: 'bug', label: 'Bug', Icon: Bug },
  { id: 'flower', label: 'Flower', Icon: Flower2 },
  { id: 'leaf', label: 'Leaf', Icon: Leaf },
  { id: 'sun', label: 'Sun', Icon: Sun },
];

const allOptions = [...reactionIconOptions, ...stickerIconOptions];

export const chatIconById: Record<string, LucideIcon> = Object.fromEntries(
  allOptions.map((option) => [option.id, option.Icon]),
) as Record<string, LucideIcon>;

export const getChatIconId = (content: string): string | null => {
  const prefix = '[icon]';
  if (!content.startsWith(prefix)) {
    return null;
  }

  const iconId = content.slice(prefix.length).trim();
  return iconId || null;
};
