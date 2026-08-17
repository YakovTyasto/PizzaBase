import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations()
  return (
    <div className="py-10">
      <EmptyState
        title={t('errors.notFound')}
        hint={t('errors.notFoundHint')}
        action={
          <Link href="/">
            <Button>{t('nav.home')}</Button>
          </Link>
        }
      />
    </div>
  )
}
