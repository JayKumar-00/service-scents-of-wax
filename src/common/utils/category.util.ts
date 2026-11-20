export const categoryIncludeBreadcrumb = {
  include: {
    parent: {
      include: {
        parent: {
          include: { parent: true },
        },
      },
    },
  },
} as const;
