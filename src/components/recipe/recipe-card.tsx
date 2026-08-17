import { Clock, Flame } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Badge, Card } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import type { RecipeSummary } from '@/lib/data/types'
import { AuthenticityBadge, FallbackBadge, ReviewBadge, StatusBadge } from './badges'

/**
 * The library card. It leads with what the brief asks a card to answer at a
 * glance: style, source, time, oven and how settled the recipe is.
 */
export async function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const t = await getTranslations()
  const totalMinutes = (recipe.activeMinutes ?? 0) + (recipe.passiveMinutes ?? 0)

  return (
    <Card className="transition-shadow hover:shadow-[var(--shadow-raised)]">
      <Link href={`/recipes/${recipe.slug}`} className="block p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{t(`recipeType.${recipe.type}`)}</Badge>
          <AuthenticityBadge value={recipe.authenticity} />
          <StatusBadge status={recipe.status} />
          <ReviewBadge openQuestions={recipe.openQuestions} hasConflict={recipe.hasConflict} />
        </div>

        <h3 className="font-display text-xl leading-snug font-semibold text-ink">
          {recipe.name.value}
          <FallbackBadge text={recipe.name} />
        </h3>

        {recipe.summary ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{recipe.summary.value}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
          {recipe.styleName ? <span>{recipe.styleName.value}</span> : null}
          {totalMinutes > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" />
              {totalMinutes >= 60
                ? t('common.hours', { count: Math.round(totalMinutes / 60) })
                : t('common.minutes', { count: totalMinutes })}
            </span>
          ) : null}
          {recipe.ovenName ? (
            <span className="inline-flex items-center gap-1">
              <Flame aria-hidden className="size-3.5" />
              {recipe.ovenName.value}
            </span>
          ) : null}
        </div>

        {recipe.source?.author ? (
          <p className="mt-2 text-xs text-ink-faint">{recipe.source.author}</p>
        ) : null}
      </Link>
    </Card>
  )
}
