export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  platforms: string[];
  imageUrl: string | null;
  lowestPrice: number;
  regularPrice: number | null;
  discountPercent: number | null;
  currency: string;
  offerCount: number;
};

export type ProductOffer = {
  id: number;
  sellerName: string;
  platform: string;
  platformSlug: string;
  region: string;
  regionSlug: string;
  price: number;
  regularPrice: number | null;
  currency: string;
};

export type ProductMedia = {
  id: number;
  mediaType: 'cover' | 'screenshot';
  imageUrl: string;
  thumbnailUrl: string;
  altText: string;
};

export type ProductDescriptionSection = {
  id: number;
  heading: string;
  body: string;
};

export type ProductMetadata = {
  releaseDate: string | null;
  publisher: string | null;
  developer: string | null;
  genres: string[];
  languages: string[];
  sourceUrl: string | null;
};

export type ProductRatings = {
  reviewCount: number;
  overall: number | null;
  gameplay: number | null;
  story: number | null;
  graphics: number | null;
  soundtrack: number | null;
};

export type SteamReview = {
  id: string;
  text: string;
  recommended: boolean;
  createdAt: number;
  language: string;
  helpfulVotes: number;
};

export type SteamReviews = {
  available: boolean;
  message: string | null;
  steamAppId: number | null;
  steamUrl: string | null;
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  positivePercent: number | null;
  reviews: SteamReview[];
  fetchedAt: string | null;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser | null;
  csrfToken: string;
};

export type AccountProfile = AuthUser & {
  createdAt: string;
};

export type AccountOrderItem = {
  id: number;
  slug: string;
  productName: string;
  sellerName: string;
  unitPrice: number;
  quantity: number;
  digitalKeys: Array<{
    value: string;
    deliveredAt: string | null;
  }>;
};

export type AccountOrder = {
  id: number;
  status: string;
  paymentStatus: 'pending' | 'succeeded' | 'failed' | null;
  total: number;
  currency: string;
  createdAt: string;
  items: AccountOrderItem[];
};

export type AccountOrderHistory = {
  orders: AccountOrder[];
};

export type CheckoutResult = {
  orderId: number;
  status: 'paid';
  total: number;
  currency: string;
};

export type CommunityReview = {
  id: number;
  userName: string;
  rating: number;
  reviewText: string;
  isDemo: boolean;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunityReviews = {
  summary: {
    averageRating: number | null;
    totalReviews: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  reviews: CommunityReview[];
  userReview: CommunityReview | null;
  demoReviewsIncluded: boolean;
};

export type RecommendedProduct = {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  platforms: string[];
  regions: string[];
  lowestPrice: number;
  currency: string;
  cashbackPercent: number | null;
};

export type ProductDetails = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  platforms: string[];
  regions: string[];
  offers: ProductOffer[];
  gallery: ProductMedia[];
  descriptionSections: ProductDescriptionSection[];
  metadata: ProductMetadata;
  ratings: ProductRatings | null;
  recommendations: RecommendedProduct[];
};

export type HomepageBanner = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
};

export type HomepageSection<T> = {
  title: string;
  subtitle: string;
  items: T[];
};

export type CategorySummary = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
};

export type PlatformSummary = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
};
