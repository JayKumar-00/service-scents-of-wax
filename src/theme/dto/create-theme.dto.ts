import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PanelType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateThemeDto {
  @ApiProperty({
    description:
      'The type of admin panel (e.g., "default", "modern", "minimal")',
    enum: PanelType,
    example: PanelType.ADMIN,
  })
  @IsEnum(PanelType)
  @IsNotEmpty()
  panelType!: PanelType;

  // Branding
  @ApiPropertyOptional({
    description: 'The name of the site to be displayed in the admin panel',
    example: 'My Awesome Site',
    required: false,
  })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({
    description:
      'A short tagline or description for the site, displayed in the admin panel',
    example: 'The best site for all your needs',
    required: false,
  })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({
    description:
      'URL to the logo image to be displayed in the admin panel header (e.g., "https://example.com/logo.png")',
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Brand Colors
  @ApiPropertyOptional({
    description:
      'The primary color for the admin panel, used for buttons, links, and highlights (e.g., "#3498db")',
    example: '#3498db',
    required: false,
  })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({
    description:
      'The secondary color for the admin panel, used for accents and complementary elements (e.g., "#2ecc71")',
    example: '#2ecc71',
    required: false,
  })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  // Layout Colors
  @ApiPropertyOptional({
    description:
      'The background color for the admin panel, applied to the main content area (e.g., "#ffffff")',
    example: '#ffffff',
    required: false,
  })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({
    description:
      'The surface color for cards, modals, and other UI elements in the admin panel (e.g., "#f5f5f5")',
    example: '#f5f5f5',
    required: false,
  })
  @IsOptional()
  @IsString()
  surfaceColor?: string;

  @ApiPropertyOptional({
    description:
      'The border color for UI elements in the admin panel, used for dividers and outlines (e.g., "#e0e0e0")',
    example: '#e0e0e0',
    required: false,
  })
  @IsOptional()
  @IsString()
  borderColor?: string;

  // Text Colors
  @ApiPropertyOptional({
    description:
      'The color for headings in the admin panel, used for titles and section headers (e.g., "#333333")',
    example: '#333333',
    required: false,
  })
  @IsOptional()
  @IsString()
  headingColor?: string;

  @ApiPropertyOptional({
    description:
      'The color for body text in the admin panel, used for regular content and descriptions (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({
    description:
      'The color for muted or secondary text in the admin panel, used for less prominent information (e.g., "#999999")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  mutedColor?: string;

  // Sidebar
  @ApiPropertyOptional({
    description:
      'The background color for the sidebar in the admin panel, applied to the sidebar area (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarBgColor?: string;

  @ApiPropertyOptional({
    description:
      'The text color for the sidebar in the admin panel, applied to sidebar links and labels (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarTextColor?: string;

  @ApiPropertyOptional({
    description:
      'The background color for active items in the sidebar, applied to the currently active link or section (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarActiveBgColor?: string;

  @ApiPropertyOptional({
    description:
      'The text color for active items in the sidebar, applied to the currently active link or section (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarActiveTextColor?: string;

  @ApiPropertyOptional({
    description:
      'The background color for hovered items in the sidebar, applied when hovering over links or sections (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarHoverBgColor?: string;

  @ApiPropertyOptional({
    description:
      'The text color for hovered items in the sidebar, applied when hovering over links or sections (e.g., "#666666")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarHoverTextColor?: string;

  @ApiPropertyOptional({
    description:
      'The font family for the sidebar in the admin panel, applied to sidebar links and labels (e.g., "Arial, sans-serif")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarFontFamily?: string;

  @ApiPropertyOptional({
    description:
      'The border radius for the sidebar in the admin panel, applied to the corners of the sidebar (e.g., "4px")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  sidebarBorderRadius?: string;

  // Typography
  @ApiPropertyOptional({
    description:
      'The font family for the admin panel, applied to all text elements (e.g., "Arial, sans-serif")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional({
    description:
      'The font family for headings in the admin panel, applied to titles and section headers (e.g., "Arial, sans-serif")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  headingFontFamily?: string;

  @ApiPropertyOptional({
    description:
      'The base font size for the admin panel, applied to body text and other elements (e.g., "14px")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseFontSize?: string;

  // Advanced
  @ApiPropertyOptional({
    description:
      'Custom CSS to be applied to the admin panel, allowing for additional styling and overrides (e.g., "body { background-color: #666666; }")',
    example: '#666666',
    required: false,
  })
  @IsOptional()
  @IsString()
  customCss?: string;
}
