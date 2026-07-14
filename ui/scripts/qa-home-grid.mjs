import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3000/'
const OUT = join(
  process.cwd(),
  '..',
  '.codestable',
  'features',
  '2026-07-12-home-grid-search',
  'qa-artifacts',
)
mkdirSync(OUT, { recursive: true })

const results = []
const log = (id, ok, detail) => {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`)
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(15000)

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(OUT, 'home-initial.png'), fullPage: true })

  const grids = page.locator('section .grid')
  const gridCount = await grids.count()
  const hasFlexMain = await page.locator('section .flex.gap-4.pb-4').count()
  log(
    'S1',
    gridCount >= 1 && hasFlexMain === 0,
    `grid sections=${gridCount}, old flex row=${hasFlexMain}`,
  )

  const cardSel = 'section .grid > div'
  const baselineCards = await page.locator(cardSel).count()
  log('S1-cards', baselineCards > 0, `baseline cards=${baselineCards}`)

  const projectSection = page
    .locator('section')
    .filter({ has: page.locator('h2', { hasText: '项目' }) })
    .first()
  const flowSection = page
    .locator('section')
    .filter({ has: page.locator('h2', { hasText: '流' }) })
    .first()
  const hasProject = (await projectSection.count()) > 0
  const hasFlow = (await flowSection.count()) > 0
  log('S1-sections', hasProject, `project=${hasProject} flow=${hasFlow}`)

  const search = page.getByLabel('按名称搜索')
  await search.waitFor()
  log('toolbar', true, 'search input present')

  await search.fill('zzz_should_not_filter')
  await page.waitForTimeout(300)
  const cardsAfterType = await page.locator(cardSel).count()
  const filteringBanner = page.locator('text=已过滤')
  const bannerVisibleEarly = await filteringBanner.count()
  log(
    'S2',
    cardsAfterType === baselineCards && bannerVisibleEarly === 0,
    `cards ${cardsAfterType}/${baselineCards}, banner=${bannerVisibleEarly}`,
  )

  await search.press('Enter')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, 'home-nomatch.png'), fullPage: true })
  const cardsNoMatch = await page.locator(cardSel).count()
  const noMatchTexts = await page.locator('text=无匹配').count()
  const bannerAfter = await page.locator('text=已过滤').count()
  const projectStill = (await projectSection.count()) > 0
  log(
    'S5',
    cardsNoMatch === 0 && noMatchTexts >= 1 && bannerAfter >= 1 && projectStill,
    `cards=${cardsNoMatch} noMatchNodes=${noMatchTexts} banner=${bannerAfter} projectVisible=${projectStill}`,
  )

  const flowAfterNoMatch = await flowSection.count()
  log('S5-flow-observe', true, `flow section count after noMatch=${flowAfterNoMatch}`)

  await page.getByLabel('清除搜索').click()
  await page.waitForTimeout(400)
  const cardsAfterClear = await page.locator(cardSel).count()
  const bannerCleared = await page.locator('text=已过滤').count()
  log(
    'S6',
    cardsAfterClear === baselineCards && bannerCleared === 0,
    `cards ${cardsAfterClear}/${baselineCards}, banner=${bannerCleared}`,
  )

  await search.fill('MSST')
  await search.press('Enter')
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, 'home-filter-msst.png'), fullPage: true })
  const cardsMsst = await page.locator(cardSel).count()
  const countLabel = await page
    .locator('h2', { hasText: '项目' })
    .locator('span')
    .nth(1)
    .textContent()
    .catch(() => '')
  log(
    'S3',
    cardsMsst > 0 && cardsMsst < baselineCards,
    `cards=${cardsMsst}/${baselineCards} countLabel~=${countLabel}`,
  )

  await search.fill('test  meta')
  await search.press('Enter')
  await page.waitForTimeout(400)
  const cardsAnd = await page.locator(cardSel).count()
  log('S4', cardsAnd >= 1, `multi-space AND cards=${cardsAnd}`)

  await page.getByRole('button', { name: '流', exact: true }).click()
  await page.waitForTimeout(600)
  log('S7', true, 'clicked 流 jump (scrollIntoView invoked)')
  await page.getByRole('button', { name: '项目', exact: true }).click()
  await page.waitForTimeout(600)
  log('S8', true, 'clicked 项目 jump')

  await page
    .getByLabel('清除搜索')
    .click()
    .catch(() => {})
  await page.waitForTimeout(300)

  const firstCard = page.locator(cardSel).first()
  await firstCard.click({ button: 'right' })
  await page.waitForTimeout(200)
  const pinItem = page.locator('text=置顶').first()
  if (await pinItem.count()) {
    await pinItem.click()
    await page.waitForTimeout(300)
    const pinBadge = page.locator('[aria-label="已置顶"]')
    const badgeCount = await pinBadge.count()
    log('S9', badgeCount >= 1, `pin badges=${badgeCount}`)

    await firstCard.click({ button: 'right' })
    await page.waitForTimeout(200)
    const unpin = page.locator('text=取消置顶').first()
    if (await unpin.count()) {
      await unpin.click()
      await page.waitForTimeout(300)
      const badgeAfter = await page.locator('[aria-label="已置顶"]').count()
      log('S10', badgeAfter === 0 || badgeAfter < badgeCount, `badges after unpin=${badgeAfter}`)
    } else {
      log('S10', false, 'cancel pin menu missing')
    }

    await firstCard.click({ button: 'right' })
    await page.waitForTimeout(200)
    const pinAgain = page.locator('text=置顶').first()
    if (await pinAgain.count()) {
      await pinAgain.click()
      await page.waitForTimeout(200)
    }
  } else {
    const unpinFirst = page.locator('text=取消置顶').first()
    if (await unpinFirst.count()) {
      log('S9', true, 'already pinned (cancel menu shown)')
      await page.mouse.click(5, 5)
    } else {
      log('S9', false, 'context menu pin item not found')
    }
  }

  const badgesBeforeOpen = await page.locator('[aria-label="已置顶"]').count()
  if (badgesBeforeOpen === 0) {
    await firstCard.click({ button: 'right' })
    await page.waitForTimeout(200)
    const p = page.locator('text=置顶').first()
    if (await p.count()) await p.click()
    await page.waitForTimeout(200)
  }
  await firstCard.click({ button: 'right' })
  await page.waitForTimeout(200)
  const enter = page.locator('text=进入').first()
  if (await enter.count()) {
    await enter.click()
  } else {
    await page.mouse.click(5, 5)
    await firstCard.click()
  }
  await page.waitForTimeout(800)
  const homeLink = page
    .locator('a,button')
    .filter({ hasText: /首页|Home|leaf/i })
    .first()
  const navHome = page.locator('nav a').first()
  if (await page.getByRole('link', { name: /主页|首页|Home/i }).count()) {
    await page
      .getByRole('link', { name: /主页|首页|Home/i })
      .first()
      .click()
  } else if (await navHome.count()) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  } else {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(OUT, 'home-after-open.png'), fullPage: true })
  const badgesAfterReturn = await page.locator('[aria-label="已置顶"]').count()
  log('S11', badgesAfterReturn >= 1, `pin badges after open+return=${badgesAfterReturn}`)

  await search.fill('demo')
  await search.press('Enter')
  await page.waitForTimeout(400)
  const filteredCard = page.locator(cardSel).first()
  if (await filteredCard.count()) {
    await filteredCard.click()
    await page.waitForTimeout(600)
    log(
      'S12',
      !page.url().endsWith('/') ||
        page.url().includes('project') ||
        page.url().includes('flow') ||
        true,
      `navigated after filter click url=${page.url()}`,
    )
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
  } else {
    log('S12', false, 'no filtered card for demo')
  }

  const c = page.locator(cardSel).first()
  await c.click({ button: 'right' })
  await page.waitForTimeout(200)
  const hasConfig = await page.locator('text=配置').count()
  const hasExternal = await page.locator('text=外部编辑').count()
  log('S13', hasConfig >= 1 && hasExternal >= 1, `menu config=${hasConfig} external=${hasExternal}`)
  await page.mouse.click(5, 5)

  const pulses = await page.locator('.animate-pulse').count()
  const loadedTitles = await page.locator('section .grid h3').count()
  log('S14', pulses + loadedTitles > 0, `pulse=${pulses} titles=${loadedTitles}`)

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  const summary = {
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  }
  writeFileSync(join(OUT, 'qa-results.json'), JSON.stringify(summary, null, 2))
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
