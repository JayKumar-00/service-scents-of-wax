import { PrismaClient, PanelType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding themes...');

  // ADMIN THEME
  const adminThemeId = 'cmq52jsbb00006qxsfnxmgzht';
  const adminTheme = await prisma.systemTheme.upsert({
    where: { id: adminThemeId },
    update: {
      panelType: PanelType.ADMIN,
      siteName: 'Gift Factory Admin',
      tagline: 'Head-office control center',
      logoUrl:
        'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=120&h=120&fit=crop&q=80',
      primaryColor: '#ec4899',
      secondaryColor: '#db2777',
      backgroundColor: '#fff7fb',
      surfaceColor: '#ffffff',
      borderColor: '#f9a8d4',
      headingColor: '#0f172a',
      textColor: '#334155',
      mutedColor: '#64748b',
      sidebarBgColor: '#ffffff',
      sidebarTextColor: '#475569',
      sidebarActiveBgColor: '#fdf2f8',
      sidebarActiveTextColor: '#db2777',
      sidebarHoverBgColor: '#fff7fb',
      sidebarHoverTextColor: '#be185d',
      sidebarFontFamily: 'Inter, sans-serif',
      sidebarBorderRadius: '12px',
      fontFamily: 'Inter, sans-serif',
      headingFontFamily: 'Inter, sans-serif',
      baseFontSize: '14px',
      customCss:
        '/* Custom styling overrides for Gift Factory Superadmin Console */\nbody {\n  -webkit-font-smoothing: antialiased;\n}',
    },
    create: {
      id: adminThemeId,
      panelType: PanelType.ADMIN,
      siteName: 'Gift Factory Admin',
      tagline: 'Head-office control center',
      logoUrl:
        'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=120&h=120&fit=crop&q=80',
      primaryColor: '#ec4899',
      secondaryColor: '#db2777',
      backgroundColor: '#fff7fb',
      surfaceColor: '#ffffff',
      borderColor: '#f9a8d4',
      headingColor: '#0f172a',
      textColor: '#334155',
      mutedColor: '#64748b',
      sidebarBgColor: '#ffffff',
      sidebarTextColor: '#475569',
      sidebarActiveBgColor: '#fdf2f8',
      sidebarActiveTextColor: '#db2777',
      sidebarHoverBgColor: '#fff7fb',
      sidebarHoverTextColor: '#be185d',
      sidebarFontFamily: 'Inter, sans-serif',
      sidebarBorderRadius: '12px',
      fontFamily: 'Inter, sans-serif',
      headingFontFamily: 'Inter, sans-serif',
      baseFontSize: '14px',
      customCss:
        '/* Custom styling overrides for Gift Factory Superadmin Console */\nbody {\n  -webkit-font-smoothing: antialiased;\n}',
    },
  });
  console.log(`Seeded Admin Theme with ID: ${adminTheme.id}`);

  // FRANCHISE THEME
  const franchiseThemeId = 'cmq52jsbb00006qxsfnxmgzhf';
  const franchiseTheme = await prisma.systemTheme.upsert({
    where: { id: franchiseThemeId },
    update: {
      panelType: PanelType.FRANCHISE,
      siteName: 'Gift Factory Franchise',
      tagline: 'Franchise Partner Portal',
    },
    create: {
      id: franchiseThemeId,
      panelType: PanelType.FRANCHISE,
      siteName: 'Gift Factory Franchise',
      tagline: 'Franchise Partner Portal',
    },
  });
  console.log(`Seeded Franchise Theme with ID: ${franchiseTheme.id}`);

  // WEB THEME
  const webThemeId = 'cmq52jsbb00006qxsfnxmgzhw';
  const webTheme = await prisma.theme.upsert({
    where: { id: webThemeId },
    update: {
      siteName: 'Gift Factory',
      fontFamily: 'Inter, sans-serif',
      backgroundColor: '#ffffff',
      textColor: '#161615',
      primaryColor: '#cc176b',
      primaryForeground: '#ffffff',
      secondaryColor: '#62182d',
      secondaryForeground: '#ffffff',
      borderColor: '#e0e0e0',
      headerPromoBg: '#cc176b',
      headerPromoText: '#ffffff',
      headerCategoryPillBg: '#fde7f3',
      headerCategoryPillText: '#cc176b',
      footerBg: '#050b18',
      footerText: '#cbd5e1',
      footerBorder: '#0f172a',
      cartBadgeBg: '#cc176b',
      cartBadgeText: '#ffffff',
    },
    create: {
      id: webThemeId,
      siteName: 'Gift Factory',
      fontFamily: 'Inter, sans-serif',
      backgroundColor: '#ffffff',
      textColor: '#161615',
      primaryColor: '#cc176b',
      primaryForeground: '#ffffff',
      secondaryColor: '#62182d',
      secondaryForeground: '#ffffff',
      borderColor: '#e0e0e0',
      headerPromoBg: '#cc176b',
      headerPromoText: '#ffffff',
      headerCategoryPillBg: '#fde7f3',
      headerCategoryPillText: '#cc176b',
      footerBg: '#050b18',
      footerText: '#cbd5e1',
      footerBorder: '#0f172a',
      cartBadgeBg: '#cc176b',
      cartBadgeText: '#ffffff',
    },
  });
  console.log(`Seeded Web Theme with ID: ${webTheme.id}`);

  console.log('Seeding themes finished.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
