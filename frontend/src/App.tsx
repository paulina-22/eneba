import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { apiGet, apiMutate } from './api';
import type {
  AuthSession,
  AuthUser,
  AccountOrderHistory,
  AccountProfile,
  CategorySummary,
  CheckoutResult,
  CommunityReview,
  CommunityReviews,
  HomepageBanner,
  HomepageSection,
  PlatformSummary,
  Product,
  ProductDescriptionSection,
  ProductDetails,
  ProductOffer,
  ProductRatings,
  RecommendedProduct,
} from './data';
import { useApiResource } from './useApiResource';

type CartItem = {
  product: Pick<ProductDetails, 'slug' | 'name' | 'imageUrl'>;
  offer: ProductOffer;
  quantity: number;
};

function scrollToSectionWhenAvailable(id: string): () => void {
  let observer: MutationObserver | undefined;
  let timeoutId: number | undefined;
  let cancelled = false;

  const stopObserving = () => {
    observer?.disconnect();
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
  const attemptScroll = () => {
    if (cancelled) return false;
    const section = document.getElementById(id);
    if (!section || section.hasAttribute('data-scroll-loading')) return false;

    section.scrollIntoView({ behavior: 'instant', block: 'start' });
    stopObserving();
    return true;
  };

  if (!attemptScroll()) {
    observer = new MutationObserver(attemptScroll);
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      subtree: true,
    });
    timeoutId = window.setTimeout(stopObserving, 10000);
  }

  return () => {
    cancelled = true;
    stopObserving();
  };
}

type CartContextValue = {
  items: CartItem[];
  addOffer: (product: ProductDetails, offer: ProductOffer) => void;
  setQuantity: (offerId: number, quantity: number) => void;
  removeOffer: (offerId: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

type Language = 'en' | 'lt';
type DisplayCurrency = 'EUR' | 'USD';

type PreferencesContextValue = {
  language: Language;
  currency: DisplayCurrency;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: DisplayCurrency) => void;
  t: (text: string) => string;
  formatPrice: (value: number, sourceCurrency: string) => string;
  convertPriceToEur: (value: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const EUR_TO_USD_DEMO_RATE = 1.09;

const lithuanianTranslations: Record<string, string> = {
  'Skip to content': 'Pereiti prie turinio',
  'Open navigation menu': 'Atidaryti naršymo meniu',
  'Close navigation menu': 'Uždaryti naršymo meniu',
  'Search games': 'Ieškoti žaidimų',
  'Search games, add-ons and more': 'Ieškokite žaidimų, papildymų ir kt.',
  Search: 'Ieškoti',
  'Searching games...': 'Ieškoma žaidimų...',
  'No matching games.': 'Atitinkančių žaidimų nerasta.',
  'Unable to load search suggestions.': 'Nepavyko įkelti paieškos pasiūlymų.',
  Account: 'Paskyra',
  'Sign out': 'Atsijungti',
  'Sign in / Register': 'Prisijungti / Registruotis',
  'Sign in or create an account': 'Prisijungti arba susikurti paskyrą',
  Cart: 'Krepšelis',
  Categories: 'Kategorijos',
  Games: 'Žaidimai',
  'Order history': 'Užsakymų istorija',
  'Popular games': 'Populiarūs žaidimai',
  'Best sellers': 'Perkamiausi',
  Trending: 'Populiaru',
  Deals: 'Pasiūlymai',
  'GAMEBAY PICKS': 'GAMEBAY PASIRINKIMAI',
  'Big stories. Better prices.': 'Didelės istorijos. Geresnės kainos.',
  'Explore open worlds and fresh marketplace offers.':
    'Atraskite atvirus pasaulius ir naujus pasiūlymus.',
  'Explore best sellers': 'Atraskite perkamiausius žaidimus',
  'Find your next legend': 'Raskite kitą legendą',
  'Discover unforgettable adventures for every kind of player.':
    'Atraskite nepamirštamus nuotykius kiekvienam žaidėjui.',
  'Explore adventures': 'Atraskite nuotykius',
  'Make every lap count': 'Tegul kiekvienas ratas būna svarbus',
  'Find your next race, then take on the open road.':
    'Išsirinkite lenktynes ir leiskitės į atvirą kelią.',
  'Browse racing games': 'Naršyti lenktynių žaidimus',
  'Start a new adventure': 'Pradėkite naują nuotykį',
  'Ride out into a world of stories and discovery.':
    'Leiskitės į istorijų ir atradimų pasaulį.',
  'See new arrivals': 'Peržiūrėti naujienas',
  'See all': 'Žiūrėti visus',
  'No products are available in this section yet.':
    'Šioje skiltyje žaidimų kol kas nėra.',
  'THE CATALOG': 'KATALOGAS',
  'Browse games': 'Naršyti žaidimus',
  'Find your next game': 'Raskite kitą žaidimą',
  'Explore digital games and compare current seller offers.':
    'Naršykite skaitmeninius žaidimus ir palyginkite pardavėjų pasiūlymus.',
  'Filter by platform, region and price, then compare seller offers.':
    'Filtruokite pagal platformą, regioną ir kainą, tada palyginkite pasiūlymus.',
  Filters: 'Filtrai',
  'Hide filters': 'Slėpti filtrus',
  'Clear filters': 'Išvalyti filtrus',
  'Refine the available offers.': 'Patikslinkite pasiūlymus.',
  Platform: 'Platforma',
  'All platforms': 'Visos platformos',
  Region: 'Regionas',
  'All regions': 'Visi regionai',
  'Minimum price': 'Minimali kaina',
  'Maximum price': 'Maksimali kaina',
  'No limit': 'Be apribojimo',
  'Sort by': 'Rūšiuoti pagal',
  'Most popular': 'Populiariausi',
  'Price: low to high': 'Kaina: nuo mažiausios',
  'Price: high to low': 'Kaina: nuo didžiausios',
  Name: 'Pavadinimas',
  'Apply filters': 'Taikyti filtrus',
  'READY TO PLAY': 'PASIRUOŠĘ ŽAISTI',
  'Games for you': 'Žaidimai jums',
  'Loading games...': 'Įkeliami žaidimai...',
  'No products found': 'Žaidimų nerasta',
  'No products match your filters. Try changing them or clear all filters.':
    'Pagal pasirinktus filtrus žaidimų nerasta. Pakeiskite filtrus arba juos išvalykite.',
  'Load more games': 'Įkelti daugiau žaidimų',
  'Loading more...': 'Įkeliama daugiau...',
  'Starting at': 'Nuo',
  offer: 'pasiūlymas',
  offers: 'pasiūlymai',
  'Available platforms': 'Galimos platformos',
  'More details': 'Daugiau informacijos',
  'Show less': 'Rodyti mažiau',
  'View offers': 'Peržiūrėti pasiūlymus',
  'Compare offers for': 'Palyginti pasiūlymus: ',
  'YOUR CART': 'JŪSŲ KREPŠELIS',
  'Review your offers': 'Peržiūrėkite pasiūlymus',
  'Each item keeps the seller and offer you selected.':
    'Kiekvienam elementui išsaugomas pasirinktas pardavėjas ir pasiūlymas.',
  Quantity: 'Kiekis',
  Remove: 'Pašalinti',
  'Order summary': 'Užsakymo suvestinė',
  Items: 'Prekės',
  Total: 'Iš viso',
  'Continue to checkout': 'Tęsti atsiskaitymą',
  'Sign in to checkout': 'Prisijunkite, kad atsiskaitytumėte',
  'Checkout requires an account. Payment is simulated; no real charge is made.':
    'Atsiskaitymui reikia paskyros. Mokėjimas imituojamas, pinigai nenuskaitomi.',
  'Continue browsing games': 'Toliau naršyti žaidimus',
  'Your cart is empty': 'Jūsų krepšelis tuščias',
  'Browse the store to find a game you love.':
    'Naršykite parduotuvę ir raskite mėgstamą žaidimą.',
  'Browse the store': 'Naršyti parduotuvę',
  Home: 'Pradžia',
  'YOUR NEXT GAME STARTS HERE': 'KITA JŪSŲ ŽAIDIMO PATIRTIS PRASIDEDA ČIA',
  'Find your next': 'Raskite kitą',
  'favorite game.': 'mėgstamą žaidimą.',
  'Welcome back,': 'Sveiki sugrįžę,',
  'player.': 'žaidėjau.',
  'Create your Gamebay account to keep your orders, digital keys, and game reviews together.':
    'Sukurkite Gamebay paskyrą, kad vienoje vietoje matytumėte užsakymus, skaitmeninius raktus ir atsiliepimus.',
  'Sign in to pick up where you left off and see your orders, digital keys, and game reviews.':
    'Prisijunkite, kad tęstumėte ir peržiūrėtumėte užsakymus, skaitmeninius raktus bei atsiliepimus.',
  'One account for your games and marketplace orders':
    'Viena paskyra žaidimams ir užsakymams',
  'GAMEBAY ACCOUNT': 'GAMEBAY PASKYRA',
  'Create an account': 'Sukurti paskyrą',
  'Sign in': 'Prisijungti',
  'Enter your details to get started.': 'Įveskite duomenis, kad pradėtumėte.',
  'Use your email and password to continue.':
    'Norėdami tęsti, įveskite el. paštą ir slaptažodį.',
  'Email address': 'El. pašto adresas',
  Password: 'Slaptažodis',
  'Your name': 'Jūsų vardas',
  'At least 8 characters': 'Bent 8 simboliai',
  'Your password': 'Jūsų slaptažodis',
  'Could not establish a secure session.': 'Nepavyko sukurti saugios sesijos.',
  'Try again': 'Bandyti dar kartą',
  'Please wait...': 'Palaukite...',
  'Create account': 'Sukurti paskyrą',
  'Your password is securely hashed by the backend.':
    'Jūsų slaptažodis saugiai užšifruojamas serveryje.',
  'Your password is verified securely by the backend.':
    'Jūsų slaptažodis saugiai patikrinamas serveryje.',
  'Already have an account?': 'Jau turite paskyrą?',
  'New to Gamebay?': 'Naujas Gamebay?',
  'PAGE NOT FOUND': 'PUSLAPIS NERASTAS',
  'Looks like a wrong turn.': 'Panašu, kad pasukote ne ten.',
  'Back to home': 'Grįžti į pradžią',
  Discover: 'Atraskite',
  'Your account': 'Jūsų paskyra',
  'Sign in or register': 'Prisijungti arba registruotis',
  'Shopping cart': 'Pirkinių krepšelis',
  'Account for': 'Paskyra:',
  'Signed in as': 'Prisijungta kaip',
  items: 'prekės',
  'DEMO MARKETPLACE': 'DEMO PARDUOTUVĖ',
  'Example listings only. No real payment is processed on this site.':
    'Tai tik demonstraciniai pasiūlymai. Tikri mokėjimai nevykdomi.',
  'Made for players, wherever they play.':
    'Sukurta žaidėjams, kad ir kur jie žaistų.',
  'Language': 'Kalba',
  'Currency': 'Valiuta',
  'Prices shown in euros': 'Kainos pateiktos eurais',
  'Available regions': 'Galimi regionai',
  'Check seller offer': 'Patikrinkite pardavėjo pasiūlymą',
  'Digital format': 'Skaitmeninis formatas',
  'Compare sellers': 'Palyginti pardavėjus',
  'BEST AVAILABLE PRICE': 'GERIAUSIA PRIEINAMA KAINA',
  'Add another to cart': 'Įdėti dar vieną į krepšelį',
  'Add best offer to cart': 'Įdėti geriausią pasiūlymą į krepšelį',
  'Compare all offers': 'Palyginti visus pasiūlymus',
  'No active offers are available right now.':
    'Šiuo metu aktyvių pasiūlymų nėra.',
  'Marketplace demo': 'Parduotuvės demonstracija',
  'SEE THE GAME': 'ŽAIDIMO GALERIJA',
  'Game gallery': 'Žaidimo galerija',
  'Important purchase information': 'Svarbi pirkimo informacija',
  'Available versions and offers': 'Galimos versijos ir pasiūlymai',
  'Compare editions, platform, region, seller, and price before choosing.':
    'Prieš pasirinkdami palyginkite leidimus, platformą, regioną, pardavėją ir kainą.',
  Seller: 'Pardavėjas',
  Price: 'Kaina',
  'Add to cart': 'Įdėti į krepšelį',
  'No seller offers available': 'Pardavėjų pasiūlymų nėra',
  'PRODUCT FACTS': 'ŽAIDIMO INFORMACIJA',
  'Additional information': 'Papildoma informacija',
  'Release date': 'Išleidimo data',
  Publisher: 'Leidėjas',
  Developer: 'Kūrėjas',
  Genre: 'Žanras',
  'No additional product information is available.':
    'Papildomos žaidimo informacijos nėra.',
  'Return to the store': 'Grįžti į parduotuvę',
};

Object.assign(lithuanianTranslations, {
  'Search suggestions': 'Paieškos pasiūlymai',
  'Loading featured content...': 'Įkeliama pagrindinė informacija...',
  'Featured content is not available.': 'Pagrindinis turinys nepasiekiamas.',
  'Loading marketplace section...': 'Įkeliama parduotuvės skiltis...',
  'This section is not available.': 'Ši skiltis nepasiekiama.',
  'Loading browse shortcuts...': 'Įkeliami naršymo spartieji klavišai...',
  'Browse categories are not available.': 'Kategorijos nepasiekiamos.',
  'Loading more browse options...': 'Įkeliama daugiau naršymo parinkčių...',
  'Store filters': 'Parduotuvės filtrai',
  'Results for': 'Paieškos rezultatai:',
  'Finding games...': 'Ieškoma žaidimų...',
  'No products matched that search. Try another spelling or browse the full catalog.':
    'Pagal paiešką žaidimų nerasta. Pabandykite kitą užklausą arba naršykite katalogą.',
  'The catalog is empty right now. Please check back soon.':
    'Katalogas šiuo metu tuščias. Apsilankykite vėliau.',
  'Browse all games': 'Naršyti visus žaidimus',
  Showing: 'Rodoma',
  games: 'žaidimai',
  'Unable to load more games.': 'Nepavyko įkelti daugiau žaidimų.',
  'Unable to load the store.': 'Nepavyko įkelti parduotuvės.',
  View: 'Peržiūrėti',
  'product details': 'žaidimo informaciją',
  'Artwork unavailable': 'Paveikslėlis nepasiekiamas',
  active: 'aktyvūs',
  'to compare': 'palyginimui',
  'Best available offer': 'Geriausias pasiūlymas',
  'Gamebay offers': 'Gamebay pasiūlymai',
  seller: 'pardavėjo',
  'Best offer from': 'Geriausias pasiūlymas iš',
  'Open image full screen': 'Atidaryti paveikslėlį per visą ekraną',
  'image viewer': 'paveikslėlio peržiūra',
  'Close image viewer': 'Uždaryti paveikslėlio peržiūrą',
  'DIGITAL GAME': 'SKAITMENINIS ŽAIDIMAS',
  Platforms: 'Platformos',
  "Digital game listing; review each seller's platform and region details.":
    'Skaitmeninio žaidimo pasiūlymas; patikrinkite pardavėjo platformą ir regioną.',
  'Checkout is simulated with no real charge. Confirm the selected offer\'s platform and region before purchase.':
    'Atsiskaitymas imituojamas, mokestis nenuskaitomas. Prieš pirkdami patikrinkite platformą ir regioną.',
  'cover art': 'viršelio paveikslėlis',
  'game screenshot': 'žaidimo ekrano nuotrauka',
  Show: 'Rodyti',
  for: 'žaidimui',
  'Cover art': 'Viršelio paveikslėlis',
  Screenshot: 'Ekrano nuotrauka',
  'Digital offers can differ by platform and region. Confirm the selected seller\'s offer details before adding it to your cart.':
    'Skaitmeniniai pasiūlymai gali skirtis pagal platformą ir regioną. Prieš įdėdami į krepšelį patikrinkite pardavėjo pasiūlymą.',
  'COMPARE PRICES': 'PALYGINKITE KAINAS',
  available: 'pasiekiama',
  'Best price': 'Geriausia kaina',
  Add: 'Įdėti',
  'offer from': 'pasiūlymą iš',
  'to cart': 'į krepšelį',
  'There are no active offers for this game at the moment. Please check back later.':
    'Šiuo metu šiam žaidimui aktyvių pasiūlymų nėra. Apsilankykite vėliau.',
  'MORE TO EXPLORE': 'DAUGIAU ATRADIMŲ',
  'Recommended products': 'Rekomenduojami žaidimai',
  'Scroll recommended products left': 'Slinkti rekomenduojamus žaidimus kairėn',
  'Scroll recommended products right': 'Slinkti rekomenduojamus žaidimus dešinėn',
  'Platform details unavailable': 'Platformos informacijos nėra',
  'Region details unavailable': 'Regiono informacijos nėra',
  Cashback: 'Pinigų grąža',
  'not specified': 'nenurodyta',
  'No recommended products are available right now.': 'Šiuo metu rekomendacijų nėra.',
  'ABOUT THIS GAME': 'APIE ŠĮ ŽAIDIMĄ',
  'Read less': 'Skaityti mažiau',
  'Read more': 'Skaityti daugiau',
  'PRODUCT FACTS': 'ŽAIDIMO INFORMACIJA',
  Offer: 'Pasiūlymas',
  each: 'už vienetą',
  'Quantity for': 'Kiekis:',
  'Cart summary': 'Krepšelio suvestinė',
  'Your next game goes here': 'Čia laukia kitas jūsų žaidimas',
  'Your cart is empty for now. Take a look around and find something you love.':
    'Jūsų krepšelis tuščias. Apsižvalgykite ir raskite patinkantį žaidimą.',
  'Checking your sign-in...': 'Tikrinamas prisijungimas...',
  Retry: 'Bandyti dar kartą',
  'YOUR GAMEBAY': 'JŪSŲ GAMEBAY',
  'Manage your account details and find your previous purchases.':
    'Tvarkykite paskyros informaciją ir peržiūrėkite ankstesnius pirkinius.',
  'Loading your account...': 'Įkeliama paskyra...',
  'ACCOUNT DETAILS': 'PASKYROS INFORMACIJA',
  'Member since': 'Narys nuo',
  'View order history': 'Peržiūrėti užsakymų istoriją',
  'YOUR PURCHASES': 'JŪSŲ PIRKINIAI',
  'Payment status, purchased offers, and any delivered digital keys.':
    'Mokėjimo būsena, įsigyti pasiūlymai ir pristatyti skaitmeniniai raktai.',
  'Loading your orders...': 'Įkeliami užsakymai...',
  'NO ORDERS YET': 'UŽSAKYMŲ DAR NĖRA',
  'Your order history is empty': 'Užsakymų istorija tuščia',
  'Your purchases, payment status, and any delivered keys will appear here.':
    'Čia bus rodomi pirkiniai, mokėjimo būsena ir pristatyti raktai.',
  'Your orders': 'Jūsų užsakymai',
  Order: 'Užsakymas',
  Payment: 'Mokėjimas',
  Qty: 'Kiekis',
  'Digital key': 'Skaitmeninis raktas',
  'Digital keys': 'Skaitmeniniai raktai',
  'demo only, not redeemable': 'tik demonstracinis, negaliojantis',
  Paid: 'Apmokėta',
  'Pending payment': 'Laukiama mokėjimo',
  Cancelled: 'Atšaukta',
  Unknown: 'Nežinoma',
  Succeeded: 'Pavyko',
  Pending: 'Laukiama',
  Failed: 'Nepavyko',
  'Not recorded': 'Nenurodyta',
  'We could not complete the simulated payment. Please try again.':
    'Nepavyko atlikti bandomojo mokėjimo. Bandykite dar kartą.',
  'DEMO CHECKOUT': 'DEMONSTRACINIS ATSISKAITYMAS',
  'Review and complete your order': 'Peržiūrėkite ir patvirtinkite užsakymą',
  'Only your selected seller offers will be purchased.':
    'Bus įsigyti tik jūsų pasirinkti pardavėjų pasiūlymai.',
  'PAYMENT SIMULATED SUCCESSFULLY': 'BANDOMASIS MOKĖJIMAS PAVYKO',
  'Your order is complete': 'Užsakymas užbaigtas',
  'No real payment was taken.': 'Tikras mokėjimas nebuvo atliktas.',
  'Your digital keys are available in your order history.':
    'Skaitmeninius raktus rasite užsakymų istorijoje.',
  'View order and digital keys': 'Peržiūrėti užsakymą ir skaitmeninius raktus',
  'NOTHING TO CHECK OUT': 'NĖRA KĄ APMOKĖTI',
  'Add a seller offer to your cart before continuing.':
    'Prieš tęsdami įdėkite pardavėjo pasiūlymą į krepšelį.',
  'Items in your order': 'Jūsų užsakymo prekės',
  'Checkout summary': 'Atsiskaitymo suvestinė',
  'Checkout requires all selected offers to use one currency. Remove items from different currencies in your cart.':
    'Visi pasirinkti pasiūlymai turi būti ta pačia valiuta. Pašalinkite skirtingų valiutų prekes.',
  'Processing demo payment...': 'Vykdomas bandomasis mokėjimas...',
  'Complete simulated purchase': 'Užbaigti bandomąjį pirkimą',
  'Demo only. This button simulates an approved payment; no card details or real money are used. Order creation and key assignment succeed or roll back together.':
    'Tik demonstracija. Mokėjimas imituojamas; kortelės duomenys ir tikri pinigai nenaudojami.',
  'Return to cart': 'Grįžti į krepšelį',
  'Built as a marketplace demo.': 'Sukurta kaip prekyvietės demonstracija.',
  'A little corner of the internet for your next favorite game.':
    'Jūsų kampelis internete kitam mėgstamam žaidimui.',
  'Demo marketplace · No real payment is processed': 'Demonstracinė parduotuvė · Tikri mokėjimai nevykdomi',
  'Action RPG': 'Veiksmo RPG',
  Action: 'Veiksmas',
  Adventure: 'Nuotykiai',
  Racing: 'Lenktynės',
  Strategy: 'Strategija',
  Survival: 'Išgyvenimas',
  Simulation: 'Simuliacija',
  Sandbox: 'Smėlio dėžė',
  Global: 'Pasaulinis',
  Europe: 'Europa',
  'North America': 'Šiaurės Amerika',
  'PlayStation 5': 'PlayStation 5',
  'Xbox Series X|S': 'Xbox Series X|S',
  'Made for players, wherever they play.':
    'Sukurta žaidėjams, kad ir kur jie žaistų.',
  'GAMEBAY PICKS': 'GAMEBAY PASIRINKIMAI',
  'PLAYER FEEDBACK': 'ŽAIDĖJŲ ATSILIEPIMAI',
  'Player ratings and reviews': 'Žaidėjų įvertinimai ir atsiliepimai',
  'Loading player reviews...': 'Įkeliami žaidėjų atsiliepimai...',
  'Reviews could not be loaded.': 'Atsiliepimų nepavyko įkelti.',
  'out of 5': 'iš 5',
  review: 'atsiliepimas',
  reviews: 'atsiliepimai',
  'Rating distribution': 'Įvertinimų pasiskirstymas',
  with: 'su',
  stars: 'žvaigždutėmis',
  'Demo reviews are sample content only; they are not customer feedback.':
    'Demonstraciniai atsiliepimai yra pavyzdžiai, o ne tikrų klientų nuomonės.',
  'Checking your account...': 'Tikrinama paskyra...',
  'You have already reviewed this game. Manage it from your review below.':
    'Jau parašėte atsiliepimą apie šį žaidimą. Tvarkykite jį žemiau.',
  'Edit your review': 'Redaguoti atsiliepimą',
  'Write a review': 'Parašyti atsiliepimą',
  'Your rating': 'Jūsų įvertinimas',
  star: 'žvaigždutė',
  'Your review': 'Jūsų atsiliepimas',
  'Share your experience with this game...': 'Pasidalykite įspūdžiais apie šį žaidimą...',
  'Saving...': 'Išsaugoma...',
  'Save changes': 'Išsaugoti pakeitimus',
  'Publish review': 'Paskelbti atsiliepimą',
  Cancel: 'Atšaukti',
  Delete: 'Ištrinti',
  'Confirm review deletion': 'Patvirtinti atsiliepimo ištrynimą',
  'Delete this review?': 'Ištrinti šį atsiliepimą?',
  'Confirm delete': 'Patvirtinti ištrynimą',
  'Keep review': 'Palikti atsiliepimą',
  'Sign in to rate this game and write a review.':
    'Prisijunkite, kad įvertintumėte žaidimą ir parašytumėte atsiliepimą.',
  'Player reviews': 'Žaidėjų atsiliepimai',
  'No reviews yet. Be the first to share your experience.':
    'Atsiliepimų dar nėra. Būkite pirmieji, pasidaliję įspūdžiais.',
  'Demo review': 'Demonstracinis atsiliepimas',
  Edited: 'Redaguota',
  Edit: 'Redaguoti',
  'Game category ratings': 'Žaidimo kategorijų įvertinimai',
  'Not rated': 'Neįvertinta',
  Gameplay: 'Žaidimo eiga',
  Story: 'Istorija',
  Graphics: 'Grafika',
  Soundtrack: 'Garso takelis',
  'Your review was updated.': 'Atsiliepimas atnaujintas.',
  'Your review was published.': 'Atsiliepimas paskelbtas.',
  'Your review was deleted.': 'Atsiliepimas ištrintas.',
  'No reviews yet': 'Atsiliepimų dar nėra',
  'Date unavailable': 'Data nepasiekiama',
  'Scroll products left': 'Slinkti žaidimus kairėn',
  'Scroll products right': 'Slinkti žaidimus dešinėn',
  'Previous promotion': 'Ankstesnė akcija',
  'Next promotion': 'Kita akcija',
  'Main navigation': 'Pagrindinis meniu',
  'Featured promotions': 'Rekomenduojamos akcijos',
  'Terms of service': 'Naudojimo sąlygos',
});

function usePreferences(): PreferencesContextValue {
  const preferences = useContext(PreferencesContext);
  if (!preferences) {
    throw new Error('Marketplace preferences must be rendered inside the preferences provider.');
  }
  return preferences;
}

function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('Cart components must be rendered inside the cart provider.');
  return context;
}

type AuthContextValue = {
  user: AuthUser | null;
  csrfToken: string;
  loading: boolean;
  error: string | null;
  setSession: (session: AuthSession) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Authentication components must be rendered inside the auth provider.');
  return context;
}

type StoreFilters = {
  platform: string;
  region: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
};

type ProductRequestFilters = Partial<StoreFilters> & {
  query?: string;
};

const PRODUCTS_PER_PAGE = 12;

const initialStoreFilters: StoreFilters = {
  platform: '',
  region: '',
  minPrice: '',
  maxPrice: '',
  sort: 'popular',
};

function productsRequestPath(
  filters: ProductRequestFilters,
  offset: number,
  limit = PRODUCTS_PER_PAGE + 1,
): string {
  const params = new URLSearchParams({
    sort: filters.sort ?? 'popular',
    limit: String(limit),
    offset: String(offset),
  });

  for (const key of ['query', 'platform', 'region', 'minPrice', 'maxPrice'] as const) {
    const value = filters[key];
    if (value) params.set(key === 'query' ? 'q' : key, value);
  }

  return `/products?${params.toString()}`;
}

function LoadingStatus({ children }: { children: string }) {
  return (
    <p className="loading-status" role="status">
      <span aria-hidden="true" className="loading-status__spinner" />
      {children}
    </p>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.2 20c.7-3.1 3.2-5 6.8-5s6.1 1.9 6.8 5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 8h14l1 12H4L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 32">
      <path d="M12 7h16a8 8 0 0 1 7.7 10l-1.6 6a3 3 0 0 1-4.9 1.5L23 20h-6l-6.2 4.5a3 3 0 0 1-4.9-1.5l-1.6-6A8 8 0 0 1 12 7Z" />
      <path d="M13 11v8m-4-4h8" />
      <circle cx="27" cy="13" r="1" />
      <circle cx="31" cy="17" r="1" />
    </svg>
  );
}

function LocaleControls({ mobile = false }: { mobile?: boolean }) {
  const { currency, language, setCurrency, setLanguage, t } = usePreferences();

  return (
    <div className={`locale-controls${mobile ? ' locale-controls--mobile' : ''}`}>
      <div aria-label={t('Language')} className="locale-controls__group" role="group">
        <button
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
          type="button"
        >
          ENG
        </button>
        <span aria-hidden="true">|</span>
        <button
          aria-pressed={language === 'lt'}
          onClick={() => setLanguage('lt')}
          type="button"
        >
          LTU
        </button>
      </div>
      <div aria-label={t('Currency')} className="locale-controls__group" role="group">
        <button
          aria-pressed={currency === 'EUR'}
          onClick={() => setCurrency('EUR')}
          type="button"
        >
          EUR
        </button>
        <span aria-hidden="true">|</span>
        <button
          aria-pressed={currency === 'USD'}
          onClick={() => setCurrency('USD')}
          type="button"
        >
          USD
        </button>
      </div>
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CarouselArrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {direction === 'left' ? (
        <path d="m15 5-7 7 7 7" />
      ) : (
        <path d="m9 5 7 7-7 7" />
      )}
    </svg>
  );
}

function BrowseIcon({ name }: { name: string }) {
  const label = name.toLowerCase();

  if (label.includes('racing')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 16h14l-2-6H7l-2 6Z" />
        <path d="m8 10 1.5-3h5L16 10M7 16v2m10-2v2" />
        <circle cx="8" cy="16" r="1" />
        <circle cx="16" cy="16" r="1" />
      </svg>
    );
  }

  if (label.includes('strategy')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    );
  }

  if (label.includes('survival')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3c1 4-3 5-2 9 1-1 2-2 2-3 4 3 5 7 2 10a6 6 0 0 1-9-5c0-3 2-5 4-7 0 3 1 4 2 4 2-3 1-5 1-8Z" />
        <path d="M12 14c2 2 2 4 0 5-2-1-2-3 0-5Z" />
      </svg>
    );
  }

  if (label.includes('simulation') || label === 'pc') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
    );
  }

  if (label.includes('playstation')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 4v15l-4-1.3c-1.5-.5-1.4-1.5.1-2l3.9-1.3m0-7.5 6 1.8c1.7.5 2 1.7 2 3.2v6.2l-4-1.2m-5.8-2.7 8.7-2.8" />
      </svg>
    );
  }

  if (label.includes('xbox')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 6c2-2 4-2 7 0 3-2 5-2 7 0 2 2 3 5 2 8-1 4-4 7-6 7-1 0-2-2-3-4-1 2-2 4-3 4-2 0-5-3-6-7-1-3 0-6 2-8Z" />
        <path d="M7 8c2 0 4 2 5 3m5-3c-2 0-4 2-5 3m-7 3 3-1m11 1-3-1" />
      </svg>
    );
  }

  if (label.includes('adventure')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m3 19 6-10 4 6 3-4 5 8H3Z" />
        <path d="m7 19 2-3 2 3m4 0 3-4 3 4" />
      </svg>
    );
  }

  if (label.includes('sandbox')) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.7 8-4.7M12 12v9" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 9h10a4 4 0 0 1 3.8 5l-.8 2.5a2 2 0 0 1-3.3.8l-1.5-1.5H8.8l-1.5 1.5a2 2 0 0 1-3.3-.8L3.2 14A4 4 0 0 1 7 9Z" />
      <path d="M8 11v4m-2-2h4m6-1h.01M18 14h.01" />
    </svg>
  );
}

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const auth = useAuth();
  const { formatPrice, t } = usePreferences();
  const [searchText, setSearchText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [authActionError, setAuthActionError] = useState<string | null>(null);
  const sectionScrollCleanup = useRef<(() => void) | null>(null);

  const handleSectionNavigation = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    setMobileMenuOpen(false);
    sectionScrollCleanup.current?.();
    sectionScrollCleanup.current = scrollToSectionWhenAvailable(id);
  };

  useEffect(() => {
    setSearchText(new URLSearchParams(location.search).get('q') ?? '');
    setMobileMenuOpen(false);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }, [location.pathname, location.search]);

  async function signOut() {
    setAuthActionError(null);
    try {
      const session = await apiMutate<AuthSession>('/auth/logout', 'POST', {}, auth.csrfToken);
      auth.setSession(session);
    } catch (requestError) {
      setAuthActionError(
        requestError instanceof Error ? requestError.message : 'Unable to sign out.',
      );
    }
  }

  useEffect(() => {
    let active = true;
    const query = searchText.trim();

    if (query.length < 2 || !suggestionsOpen) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionError(null);
      return () => {
        active = false;
      };
    }

    setSuggestionsLoading(true);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestionError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await apiGet<Product[]>(
          productsRequestPath({ query, sort: 'popular' }, 0, 5),
        );
        if (active) {
          setSuggestions(results);
          setActiveSuggestion(-1);
        }
      } catch (requestError) {
        if (active) {
          setSuggestions([]);
          setSuggestionError(
            requestError instanceof Error
              ? requestError.message
              : t('Unable to load search suggestions.'),
          );
        }
      } finally {
        if (active) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [searchText, suggestionsOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchText.trim();
    setSuggestionsOpen(false);
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  function selectSuggestion(product: Product) {
    setSearchText(product.name);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    navigate(`/products/${encodeURIComponent(product.slug)}`);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }

    if (suggestions.length === 0 || !suggestionsOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-width">
          <div className="header-main">
            <button
              aria-expanded={mobileMenuOpen}
              aria-label={t(mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu')}
              className="icon-button mobile-menu-button"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              <MenuIcon open={mobileMenuOpen} />
            </button>

            <Link aria-label="Gamebay home" className="brand" to="/">
              <span aria-hidden="true" className="brand__mark">
                <GamepadIcon />
              </span>
              <span className="brand__name">
                game<span>bay</span>
              </span>
            </Link>

            <form
              aria-label={t('Search games')}
              className="global-search"
              onSubmit={submitSearch}
              role="search"
            >
              <label className="visually-hidden" htmlFor="global-search-input">
                {t('Search games, add-ons and more')}
              </label>
              <SearchIcon />
              <input
                aria-activedescendant={
                  activeSuggestion >= 0
                    ? `global-search-suggestion-${activeSuggestion}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls="global-search-suggestions"
                aria-expanded={suggestionsOpen && searchText.trim().length >= 2}
                autoComplete="off"
                id="global-search-input"
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setSuggestionsOpen(true);
                  setActiveSuggestion(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('Search games, add-ons and more')}
                type="search"
                value={searchText}
              />
              {suggestionsOpen && searchText.trim().length >= 2 && (
                <div
                  aria-label="Search suggestions"
                  className="global-search__suggestions"
                  id="global-search-suggestions"
                >
                  {suggestionsLoading && (
                    <p className="global-search__suggestion-status" role="status">
                      {t('Searching games...')}
                    </p>
                  )}
                  {suggestionError && (
                    <p
                      className="global-search__suggestion-status global-search__suggestion-status--error"
                      role="alert"
                    >
                      {suggestionError}
                    </p>
                  )}
                  {!suggestionsLoading && !suggestionError && suggestions.length === 0 && (
                    <p className="global-search__suggestion-status" role="status">
                      {t('No matching games.')}
                    </p>
                  )}
                  {suggestions.length > 0 && (
                    <div role="listbox">
                      {suggestions.map((product, index) => (
                        <button
                          aria-selected={activeSuggestion === index}
                          className="global-search__suggestion"
                          id={`global-search-suggestion-${index}`}
                          key={product.id}
                          onClick={() => selectSuggestion(product)}
                          onMouseEnter={() => setActiveSuggestion(index)}
                          role="option"
                          type="button"
                        >
                          <span>{product.name}</span>
                          <small>
                            {product.category} · from{' '}
                            {formatPrice(product.lowestPrice, product.currency)}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button aria-label={t('Search')} type="submit">
                {t('Search')}
              </button>
            </form>

            <div className="header-actions">
              <LocaleControls />
              {auth.user ? (
                <>
                  <Link
                    aria-label={`${t('Account for')} ${auth.user.name}`}
                    className="header-action"
                    title={`${t('Signed in as')} ${auth.user.name}`}
                    to="/account"
                  >
                    <AccountIcon />
                    <span>{t('Account')}</span>
                  </Link>
                  <button
                    aria-label={`${t('Sign out')} ${auth.user.name}`}
                    className="header-action"
                    disabled={auth.loading}
                    onClick={() => void signOut()}
                    type="button"
                  >
                    <AccountIcon />
                    <span>{t('Sign out')}</span>
                  </button>
                </>
              ) : (
                <Link
                  aria-label={t('Sign in or create an account')}
                  className="header-action"
                  to="/login"
                >
                  <AccountIcon />
                  <span>{t('Sign in / Register')}</span>
                </Link>
              )}
              {authActionError && (
                <span className="header-auth-error" role="alert">{authActionError}</span>
              )}
              <Link
                aria-label={`${t('Shopping cart')}, ${items.reduce((count, item) => count + item.quantity, 0)} ${t('items')}`}
                className="header-action cart-action"
                to="/cart"
              >
                <span className="cart-action__icon">
                  <BagIcon />
                  <span className="cart-action__count">
                    {items.reduce((count, item) => count + item.quantity, 0)}
                  </span>
                </span>
                <span>{t('Cart')}</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="nav-band">
          <nav
            aria-label="Main navigation"
            className={`site-width primary-nav${mobileMenuOpen ? ' primary-nav--open' : ''}`}
          >
            <Link
              className="primary-nav__categories"
              onClick={(event) => handleSectionNavigation(event, 'categories')}
              to="/#categories"
            >
              <MenuIcon open={false} />
              {t('Categories')}
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} to="/store">
              {t('Games')}
            </Link>
            {auth.user && (
              <Link onClick={() => setMobileMenuOpen(false)} to="/orders">
                {t('Order history')}
              </Link>
            )}
            <Link onClick={(event) => handleSectionNavigation(event, 'popular-games')} to="/#popular-games">
              {t('Popular games')}
            </Link>
            <Link onClick={(event) => handleSectionNavigation(event, 'best-sellers')} to="/#best-sellers">
              {t('Best sellers')}
            </Link>
            <Link onClick={(event) => handleSectionNavigation(event, 'trending')} to="/#trending">
              {t('Trending')}
            </Link>
            <Link onClick={(event) => handleSectionNavigation(event, 'deals')} to="/#deals">
              {t('Deals')}
            </Link>
            <LocaleControls mobile />
          </nav>
        </div>
      </header>
    </>
  );
}

function HomePage() {
  const banners = useApiResource<HomepageBanner[]>('/home/banners');
  const bestSellers = useApiResource<HomepageSection<Product>>('/home/best-sellers');
  const popularGames = useApiResource<HomepageSection<Product>>('/home/popular-games');
  const deals = useApiResource<HomepageSection<Product>>('/home/deals');
  const trending = useApiResource<HomepageSection<Product>>('/home/trending');
  const categories =
    useApiResource<HomepageSection<CategorySummary>>('/home/categories');
  const platforms =
    useApiResource<HomepageSection<PlatformSummary>>('/home/platforms');

  return (
    <main className="page-main page-main--home" id="main-content">
      <BannerSection resource={banners} />
      <div className="site-width">
        <DiscoverySection categories={categories} platforms={platforms} />
        <ProductSection carousel id="popular-games" resource={popularGames} />
        <ProductSection carousel id="best-sellers" resource={bestSellers} />
        <ProductSection carousel id="deals" resource={deals} />
        <ProductSection carousel id="trending" resource={trending} />
      </div>
    </main>
  );
}

function BannerSection({
  resource,
}: {
  resource: ReturnType<typeof useApiResource<HomepageBanner[]>>;
}) {
  const { t } = usePreferences();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const banners = resource.data ?? [];
    if (paused || banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [paused, resource.data]);

  if (resource.loading) {
    return <div className="notice-card">{t('Loading featured content...')}</div>;
  }
  if (resource.error) {
    return (
      <div className="notice-card notice-card--error" role="alert">
        {resource.error}
      </div>
    );
  }
  if (!resource.data || resource.data.length === 0) {
    return <div className="empty-panel">{t('Featured content is not available.')}</div>;
  }

  const banners = resource.data;
  const moveSlide = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + banners.length) % banners.length);
  };

  return (
    <section
      aria-label={t('Featured promotions')}
      aria-roledescription="carousel"
      className="hero-gallery"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setPaused(false);
        }
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div aria-label="Main promotion" className="hero-carousel">
        <div
          className="hero-carousel__track"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {banners.map((banner, index) => (
            <article
              aria-hidden={index !== activeIndex}
              aria-label={`${index + 1} of ${banners.length}`}
              aria-roledescription="slide"
              className="hero-slide"
              key={banner.id}
            >
              {banner.imageUrl && (
                <img
                  alt=""
                  className="hero-slide__image"
                  decoding="async"
                  loading={index === activeIndex ? 'eager' : 'lazy'}
                  src={banner.imageUrl}
                />
              )}
              <div className="hero-slide__scrim" />
              <div className="hero-slide__content">
                <p className="hero-slide__eyebrow">{t('GAMEBAY PICKS')}</p>
                <h1>{t(banner.title)}</h1>
                <p className="hero-slide__description">{t(banner.subtitle)}</p>
                <Link
                  className="button button--primary"
                  tabIndex={index === activeIndex ? 0 : -1}
                  to={banner.ctaUrl}
                >
                  {t(banner.ctaLabel)}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
        {banners.length > 1 && (
          <>
            <button
              aria-label="Previous promotion"
              className="hero-carousel__arrow hero-carousel__arrow--previous"
              onClick={() => moveSlide(-1)}
              type="button"
            >
              <CarouselArrow direction="left" />
            </button>
            <button
              aria-label="Next promotion"
              className="hero-carousel__arrow hero-carousel__arrow--next"
              onClick={() => moveSlide(1)}
              type="button"
            >
              <CarouselArrow direction="right" />
            </button>
            <div aria-label="Choose a promotion" className="hero-carousel__indicators">
              {banners.map((banner, index) => (
                <button
                  aria-label={`Show promotion ${index + 1}`}
                  aria-pressed={index === activeIndex}
                  className={index === activeIndex ? 'is-active' : ''}
                  key={banner.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              ))}
            </div>
          </>
        )}
      </div>
      {banners.length > 1 && (
        <aside aria-label="More promotions" className="hero-gallery__side">
          {banners.map((banner, index) =>
            index === activeIndex ? null : (
              <button
                aria-label={`Show promotion: ${banner.title}`}
                aria-pressed={false}
                className="hero-gallery__tile"
                key={banner.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {banner.imageUrl ? (
                  <img alt="" decoding="async" loading="lazy" src={banner.imageUrl} />
                ) : (
                  <span aria-hidden="true" className="hero-gallery__tile-fallback" />
                )}
                <span className="hero-gallery__tile-title">{banner.title}</span>
              </button>
            ),
          )}
        </aside>
      )}
    </section>
  );
}

function ProductSection({
  carousel = false,
  id,
  resource,
}: {
  carousel?: boolean;
  id?: string;
  resource: ReturnType<typeof useApiResource<HomepageSection<Product>>>;
}) {
  const { t } = usePreferences();

  if (resource.loading) {
    return (
      <div
        className="notice-card content-section"
        data-scroll-loading={id ? 'true' : undefined}
        id={id}
      >
        {t('Loading marketplace section...')}
      </div>
    );
  }
  if (resource.error) {
    return (
      <div className="notice-card notice-card--error content-section" id={id} role="alert">
        {resource.error}
      </div>
    );
  }
  if (!resource.data) {
    return (
      <div className="empty-panel content-section" id={id}>
        {t('This section is not available.')}
      </div>
    );
  }

  const section = resource.data;
  return (
    <section aria-label={t(section.title)} className="content-section" id={id}>
      <div className="section-heading">
        <div>
          <h2>{t(section.title)}</h2>
          <p className="section-description">{t(section.subtitle)}</p>
        </div>
        <Link className="text-link" to="/store">
          {t('See all')} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {section.items.length === 0 ? (
        <div className="empty-panel">{t('No products are available in this section yet.')}</div>
      ) : (
        <ProductGrid carousel={carousel} products={section.items} />
      )}
    </section>
  );
}

function DiscoverySection({
  categories,
  platforms,
}: {
  categories: ReturnType<typeof useApiResource<HomepageSection<CategorySummary>>>;
  platforms: ReturnType<typeof useApiResource<HomepageSection<PlatformSummary>>>;
}) {
  const { t } = usePreferences();
  const categoryItems = categories.data?.items ?? [];
  const platformItems = platforms.data?.items ?? [];
  const errors = [categories.error, platforms.error].filter(
    (error): error is string => Boolean(error),
  );
  const isLoading = categories.loading || platforms.loading;

  if (isLoading && categoryItems.length === 0 && platformItems.length === 0) {
    return <div className="notice-card discovery-rail">{t('Loading browse shortcuts...')}</div>;
  }

  if (categoryItems.length === 0 && platformItems.length === 0) {
    if (errors.length > 0) {
      return (
        <div className="notice-card notice-card--error discovery-rail" role="alert">
          {errors.join(' ')}
        </div>
      );
    }

    return <div className="empty-panel discovery-rail">{t('Browse categories are not available.')}</div>;
  }

  return (
    <nav aria-label="Browse categories and platforms" className="discovery-rail" id="categories">
      <div className="discovery-rail__track" id="platforms">
        {categoryItems.map((category) => (
          <Link className="discovery-rail__item" key={`category-${category.id}`} to="/store">
            <span aria-hidden="true" className="discovery-rail__icon">
              <BrowseIcon name={category.name} />
            </span>
            <span className="discovery-rail__label">{t(category.name)}</span>
          </Link>
        ))}
        {platformItems.map((platform) => (
          <Link
            className="discovery-rail__item"
            key={`platform-${platform.id}`}
            to={`/store?platform=${encodeURIComponent(platform.slug)}`}
          >
            <span aria-hidden="true" className="discovery-rail__icon">
              <BrowseIcon name={platform.name} />
            </span>
            <span className="discovery-rail__label">{t(platform.name)}</span>
          </Link>
        ))}
      </div>
      {errors.length > 0 && (
        <p className="discovery-rail__error" role="alert">
          {errors.join(' ')}
        </p>
      )}
      {isLoading && (
        <p className="discovery-rail__loading" role="status">
          {t('Loading more browse options...')}
        </p>
      )}
    </nav>
  );
}

function ProductGrid({
  carousel = false,
  products,
}: {
  carousel?: boolean;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cards = products.map((product) => (
    <ProductCard homepage={carousel} key={product.id} product={product} />
  ));

  if (!carousel) {
    return <div className="product-grid">{cards}</div>;
  }

  function scrollProducts(direction: -1 | 1) {
    const track = trackRef.current;
    if (track) {
      track.scrollBy({
        left: direction * track.clientWidth * 0.8,
        behavior: 'smooth',
      });
    }
  }

  return (
    <div className="product-carousel">
      <button
        aria-label="Scroll products left"
        className="product-carousel__arrow product-carousel__arrow--left"
        onClick={() => scrollProducts(-1)}
        type="button"
      >
        <CarouselArrow direction="left" />
      </button>
      <div className="product-grid product-grid--shelf" ref={trackRef}>
        {cards}
      </div>
      <button
        aria-label="Scroll products right"
        className="product-carousel__arrow product-carousel__arrow--right"
        onClick={() => scrollProducts(1)}
        type="button"
      >
        <CarouselArrow direction="right" />
      </button>
    </div>
  );
}

function ProductCard({
  homepage = false,
  product,
}: {
  homepage?: boolean;
  product: Product;
}) {
  const { formatPrice, t } = usePreferences();
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const imageUrl = product.imageUrl && !imageUnavailable ? product.imageUrl : null;
  const price = formatPrice(product.lowestPrice, product.currency);
  const regularPrice =
    typeof product.regularPrice === 'number' && product.regularPrice > product.lowestPrice
      ? formatPrice(product.regularPrice, product.currency)
      : null;
  const cardClassName = homepage
    ? `product-card product-card--homepage${detailsExpanded ? ' is-expanded' : ''}`
    : 'product-card';

  return (
    <article className={cardClassName}>
      <Link
        aria-label={`${t('View')} ${product.name} ${t('product details')}`}
        className="product-card__art-link"
        to={`/products/${encodeURIComponent(product.slug)}`}
      >
        <div className="product-card__art" data-tone={product.id % 4}>
          {imageUrl ? (
            <img
              alt={`${product.name} cover art`}
              decoding="async"
              loading="lazy"
              onError={() => setImageUnavailable(true)}
              src={imageUrl}
            />
          ) : (
            <div aria-hidden="true" className="cover-art cover-art--fallback">
              <span className="cover-art__category">{t(product.category)}</span>
              <span className="cover-art__title">{product.name}</span>
              <span className="cover-art__edition">Artwork unavailable</span>
            </div>
          )}
          <span className="product-card__offer-count">
            {product.offerCount} {t(product.offerCount === 1 ? 'offer' : 'offers')}
          </span>
          {typeof product.discountPercent === 'number' && product.discountPercent > 0 && (
            <span className="product-card__discount">-{product.discountPercent}%</span>
          )}
        </div>
      </Link>
      {homepage && product.platforms.length > 0 && (
        <div
          aria-label={t('Available platforms')}
          className="product-card__platforms product-card__platforms--shelf"
        >
          {product.platforms.slice(0, 2).map((platform) => (
            <span key={platform}>{platform}</span>
          ))}
        </div>
      )}
      <div className="product-card__body">
        <p className="product-card__category">{t(product.category)}</p>
        <h3>
          <Link to={`/products/${encodeURIComponent(product.slug)}`}>{product.name}</Link>
        </h3>
        {!homepage && product.platforms.length > 0 && (
          <div aria-label={t('Available platforms')} className="product-card__platforms">
            {product.platforms.slice(0, 2).map((platform) => (
              <span key={platform}>{platform}</span>
            ))}
          </div>
        )}
        <p
          className="product-card__description"
          id={homepage ? `homepage-card-description-${product.id}` : undefined}
        >
          {product.description}
        </p>
        {homepage && (
          <button
            aria-controls={`homepage-card-description-${product.id}`}
            aria-expanded={detailsExpanded}
            className="product-card__details-toggle"
            onClick={() => setDetailsExpanded((expanded) => !expanded)}
            type="button"
          >
            {t(detailsExpanded ? 'Show less' : 'More details')}
            <span aria-hidden="true">{detailsExpanded ? '−' : '+'}</span>
          </button>
        )}
        <div className="product-card__bottom">
          <div>
            <span className="product-card__price-label">{t('Starting at')}</span>
            <strong className="product-card__price">{price}</strong>
            {regularPrice && <del className="product-card__regular-price">{regularPrice}</del>}
          </div>
          {!homepage && (
            <Link
              aria-label={`${t('Compare offers for')} ${product.name}`}
              className="product-card__action"
              to={`/products/${encodeURIComponent(product.slug)}`}
            >
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        {homepage && (
          <div className="product-card__home-actions">
            <Link to={`/products/${encodeURIComponent(product.slug)}`}>
              {t('View offers')} <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function SearchPage() {
  const { t } = usePreferences();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    requestVersion.current += 1;

    async function searchProducts() {
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      setProducts([]);
      setHasMore(false);
      try {
        const results = await apiGet<Product[]>(
          productsRequestPath({ query, sort: 'popular' }, 0),
        );
        if (active) {
          setProducts(results.slice(0, PRODUCTS_PER_PAGE));
          setHasMore(results.length > PRODUCTS_PER_PAGE);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : t('Unable to search products.'),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void searchProducts();
    return () => {
      active = false;
    };
  }, [query, t]);

  async function loadMoreProducts() {
    const version = requestVersion.current;
    setLoadingMore(true);
    setError(null);
    try {
      const results = await apiGet<Product[]>(
        productsRequestPath({ query, sort: 'popular' }, products.length),
      );
      if (requestVersion.current === version) {
        setProducts((current) => [...current, ...results.slice(0, PRODUCTS_PER_PAGE)]);
        setHasMore(results.length > PRODUCTS_PER_PAGE);
      }
    } catch (requestError) {
      if (requestVersion.current === version) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load more games.',
        );
      }
    } finally {
      if (requestVersion.current === version) setLoadingMore(false);
    }
  }

  return (
    <main className="page-main page-main--catalog" id="main-content">
      <div className="site-width">
        <div className="page-intro">
          <p className="eyebrow">{t('THE CATALOG')}</p>
          <h1>{query ? `${t('Results for')} “${query}”` : t('Browse games')}</h1>
          <p>{t('Explore digital games and compare current seller offers.')}</p>
        </div>
        {loading && <div className="notice-card">{t('Finding games...')}</div>}
        {error && (
          <div className="notice-card notice-card--error" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && products.length === 0 && (
          <div className="empty-panel" role="status">
            <h2>{t('No games found')}</h2>
            <p>
              {query
                ? t('No products matched that search. Try another spelling or browse the full catalog.')
                : t('The catalog is empty right now. Please check back soon.')}
            </p>
            <Link className="button button--primary" to="/store">
              {t('Browse all games')}
            </Link>
          </div>
        )}
        {!loading && products.length > 0 && (
          <>
            <p aria-live="polite" className="result-count">
              {t('Showing')} {products.length}{hasMore ? '+' : ''} {t('games')}
            </p>
            <ProductGrid products={products} />
            {hasMore && (
              <div className="catalog-pagination">
                <button
                  className="button button--primary"
                  disabled={loadingMore}
                  onClick={() => void loadMoreProducts()}
                  type="button"
                >
                  {loadingMore ? t('Loading more...') : t('Load more games')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StorePage() {
  const { convertPriceToEur, currency, t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = {
    ...initialStoreFilters,
    platform: searchParams.get('platform') ?? '',
    sort: searchParams.get('sort') ?? 'popular',
  };
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    requestVersion.current += 1;

    async function loadProducts() {
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      setProducts([]);
      setHasMore(false);

      try {
        const results = await apiGet<Product[]>(
          productsRequestPath({
            ...appliedFilters,
            minPrice: convertPriceToEur(appliedFilters.minPrice),
            maxPrice: convertPriceToEur(appliedFilters.maxPrice),
          }, 0),
        );
        if (active) {
          setProducts(results.slice(0, PRODUCTS_PER_PAGE));
          setHasMore(results.length > PRODUCTS_PER_PAGE);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load the store.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, [appliedFilters, convertPriceToEur]);

  async function loadMoreProducts() {
    const version = requestVersion.current;
    setLoadingMore(true);
    setError(null);
    try {
      const results = await apiGet<Product[]>(
        productsRequestPath({
          ...appliedFilters,
          minPrice: convertPriceToEur(appliedFilters.minPrice),
          maxPrice: convertPriceToEur(appliedFilters.maxPrice),
        }, products.length),
      );
      if (requestVersion.current === version) {
        setProducts((current) => [...current, ...results.slice(0, PRODUCTS_PER_PAGE)]);
        setHasMore(results.length > PRODUCTS_PER_PAGE);
      }
    } catch (requestError) {
      if (requestVersion.current === version) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load more games.',
        );
      }
    } finally {
      if (requestVersion.current === version) setLoadingMore(false);
    }
  }

  function updateFilter<K extends keyof StoreFilters>(key: K, value: StoreFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraftFilters({ ...initialStoreFilters });
    setAppliedFilters({ ...initialStoreFilters });
    setFiltersOpen(false);
    setSearchParams({});
  }

  return (
    <main className="page-main page-main--catalog" id="main-content">
      <div className="site-width">
        <div className="page-intro">
          <p className="eyebrow">{t('THE CATALOG')}</p>
          <h1>{t('Find your next game')}</h1>
          <p>{t('Filter by platform, region and price, then compare seller offers.')}</p>
        </div>

        <div className="store-layout">
          <aside
            aria-label={t('Store filters')}
            className={`store-sidebar${filtersOpen ? ' store-sidebar--open' : ''}`}
            id="store-filters"
          >
            <form className="filter-panel" onSubmit={applyFilters}>
              <div className="filter-panel__heading">
                <div>
                  <h2>{t('Filters')}</h2>
                  <p>{t('Refine the available offers.')}</p>
                </div>
                <button className="filter-clear" onClick={clearFilters} type="button">
                  {t('Clear filters')}
                </button>
              </div>
              <div className="filter-controls">
                <label>
                  {t('Platform')}
                  <select
                    onChange={(event) => updateFilter('platform', event.target.value)}
                    value={draftFilters.platform}
                  >
                    <option value="">{t('All platforms')}</option>
                    <option value="pc">PC</option>
                    <option value="playstation-5">PlayStation 5</option>
                    <option value="xbox-series-xs">Xbox Series X|S</option>
                  </select>
                </label>
                <label>
                  {t('Region')}
                  <select
                    onChange={(event) => updateFilter('region', event.target.value)}
                    value={draftFilters.region}
                  >
                    <option value="">{t('All regions')}</option>
                    <option value="global">Global</option>
                    <option value="europe">Europe</option>
                    <option value="north-america">North America</option>
                  </select>
                </label>
                <label>
                  {t('Minimum price')} ({currency})
                  <input
                    min="0"
                    onChange={(event) => updateFilter('minPrice', event.target.value)}
                    placeholder={currency === 'USD' ? '$0' : '€0'}
                    step="0.01"
                    type="number"
                    value={draftFilters.minPrice}
                  />
                </label>
                <label>
                  {t('Maximum price')} ({currency})
                  <input
                    min="0"
                    onChange={(event) => updateFilter('maxPrice', event.target.value)}
                    placeholder={t('No limit')}
                    step="0.01"
                    type="number"
                    value={draftFilters.maxPrice}
                  />
                </label>
                <label>
                  {t('Sort by')}
                  <select
                    onChange={(event) => updateFilter('sort', event.target.value)}
                    value={draftFilters.sort}
                  >
                    <option value="popular">{t('Most popular')}</option>
                    <option value="price-asc">{t('Price: low to high')}</option>
                    <option value="price-desc">{t('Price: high to low')}</option>
                    <option value="name">{t('Name')}</option>
                  </select>
                </label>
                <button className="button button--primary filter-submit" type="submit">
                  {t('Apply filters')}
                </button>
              </div>
            </form>
          </aside>

          <section aria-label="Store results" className="store-results">
            <div className="store-results__toolbar">
              <button
                aria-controls="store-filters"
                aria-expanded={filtersOpen}
                className="store-filters-toggle"
                onClick={() => setFiltersOpen((open) => !open)}
                type="button"
              >
                {t(filtersOpen ? 'Hide filters' : 'Filters')}
              </button>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t('READY TO PLAY')}</p>
                  <h2>{t('Games for you')}</h2>
                </div>
                {!loading && (
                  <span className="result-count">
                    {products.length}{hasMore ? '+' : ''} {t('games')}
                  </span>
                )}
              </div>
            </div>
            {loading && <div className="notice-card">{t('Loading games...')}</div>}
            {error && (
              <div className="notice-card notice-card--error" role="alert">
                {error}
              </div>
            )}
            {!loading && !error && products.length === 0 && (
              <div className="empty-panel" role="status">
                <h2>{t('No products found')}</h2>
                <p>{t('No products match your filters. Try changing them or clear all filters.')}</p>
                <button className="filter-clear" onClick={clearFilters} type="button">
                  {t('Clear filters')}
                </button>
              </div>
            )}
            {!loading && !error && products.length > 0 && <ProductGrid products={products} />}
            {!loading && !error && products.length > 0 && hasMore && (
              <div className="catalog-pagination">
                <button
                  className="button button--primary"
                  disabled={loadingMore}
                  onClick={() => void loadMoreProducts()}
                  type="button"
                >
                  {loadingMore ? t('Loading more...') : t('Load more games')}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function AuthPage({ mode }: { mode: 'register' | 'login' }) {
  const { t } = usePreferences();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === 'register';
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await apiMutate<AuthSession>(
        isRegister ? '/auth/register' : '/auth/login',
        'POST',
        isRegister ? { name, email, password } : { email, password },
        auth.csrfToken,
      );
      auth.setSession(session);
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page" id="main-content">
      <a className="skip-link" href="#auth-form-heading">
        Skip to the {isRegister ? 'registration' : 'sign-in'} form
      </a>
      <div className="auth-page__shell">
        <header className="auth-page__header">
          <Link aria-label="Gamebay home" className="brand" to="/">
            <span aria-hidden="true" className="brand__mark">
              <GamepadIcon />
            </span>
            <span className="brand__name">
              game<span>bay</span>
            </span>
          </Link>
          <LocaleControls />
        </header>
        <div className="auth-page__layout">
          <section aria-labelledby="auth-welcome-heading" className="auth-page__welcome">
            <p className="auth-page__eyebrow">{t('YOUR NEXT GAME STARTS HERE')}</p>
            <h1 id="auth-welcome-heading">
              {t(isRegister ? 'Find your next' : 'Welcome back,')}
              <br />
              <span>{t(isRegister ? 'favorite game.' : 'player.')}</span>
            </h1>
            <p>
              {t(isRegister
                ? 'Create your Gamebay account to keep your orders, digital keys, and game reviews together.'
                : 'Sign in to pick up where you left off and see your orders, digital keys, and game reviews.')}
            </p>
            <div className="auth-page__promise">
              <span aria-hidden="true">✦</span>
              <span>{t('One account for your games and marketplace orders')}</span>
            </div>
          </section>
          <section aria-labelledby="auth-form-heading" className="auth-card">
            <div className="auth-card__intro">
              <p className="auth-card__eyebrow">{t('GAMEBAY ACCOUNT')}</p>
              <h2 id="auth-form-heading">{t(isRegister ? 'Create an account' : 'Sign in')}</h2>
              <p>
                {t(isRegister
                  ? 'Enter your details to get started.'
                  : 'Use your email and password to continue.')}
              </p>
            </div>
            <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
              {isRegister && (
                <>
                  <label htmlFor="register-name">{t('Name')}</label>
                  <input
                    autoComplete="name"
                    id="register-name"
                    maxLength={120}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('Your name')}
                    required
                    type="text"
                    value={name}
                  />
                </>
              )}
              <label htmlFor={`${mode}-email`}>{t('Email address')}</label>
              <input
                autoComplete="email"
                id={`${mode}-email`}
                maxLength={190}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <label htmlFor={`${mode}-password`}>{t('Password')}</label>
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                id={`${mode}-password`}
                maxLength={72}
                minLength={isRegister ? 8 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t(isRegister ? 'At least 8 characters' : 'Your password')}
                required
                type="password"
                value={password}
              />
              {(error || auth.error) && (
                <p className="auth-form__error" role="alert">{error ?? auth.error}</p>
              )}
              {!auth.csrfToken && (
                <div className="auth-form__error" role="alert">
                  <p>{t('Could not establish a secure session.')}</p>
                  <button className="auth-form__retry" onClick={() => void auth.refresh()} type="button">
                    {t('Try again')}
                  </button>
                </div>
              )}
              <button
                className="button button--primary auth-form__submit"
                disabled={auth.loading || submitting || !auth.csrfToken}
                type="submit"
              >
                {submitting
                  ? t('Please wait...')
                  : isRegister
                    ? t('Create account')
                    : t('Sign in')}
              </button>
              <p className="auth-form__note">
                {isRegister
                  ? t('Your password is securely hashed by the backend.')
                  : t('Your password is verified securely by the backend.')}
              </p>
            </form>
            <p className="auth-card__footer">
              {isRegister
                ? <>{t('Already have an account?')} <Link state={{ from: returnTo }} to="/login">{t('Sign in')}</Link></>
                : <>{t('New to Gamebay?')} <Link state={{ from: returnTo }} to="/register">{t('Create an account')}</Link></>}
            </p>
          </section>
        </div>
        <footer className="auth-page__footer">
          <span>© 2026 Gamebay</span>
          <span>{t('Demo marketplace · No real payment is processed')}</span>
        </footer>
      </div>
    </main>
  );
}

function RecommendedProducts({ products }: { products: RecommendedProduct[] }) {
  const { formatPrice, t } = usePreferences();
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollProducts(direction: -1 | 1) {
    trackRef.current?.scrollBy({
      left: direction * (trackRef.current.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }

  return (
    <section aria-labelledby="product-recommendations-heading" className="product-recommendations">
      <div className="product-detail-section-heading">
        <div>
          <p className="eyebrow">{t('MORE TO EXPLORE')}</p>
          <h2 id="product-recommendations-heading">{t('Recommended products')}</h2>
        </div>
        {products.length > 1 && (
          <div className="product-recommendations__controls">
            <button aria-label={t('Scroll recommended products left')} onClick={() => scrollProducts(-1)} type="button">
              <CarouselArrow direction="left" />
            </button>
            <button aria-label={t('Scroll recommended products right')} onClick={() => scrollProducts(1)} type="button">
              <CarouselArrow direction="right" />
            </button>
          </div>
        )}
      </div>
      {products.length > 0 ? (
        <div className="product-recommendations__track" ref={trackRef}>
          {products.map((recommended) => (
            <article className="recommended-card" key={recommended.id}>
              <Link
                aria-label={`View ${recommended.name} product details`}
                className="recommended-card__art"
                to={`/products/${encodeURIComponent(recommended.slug)}`}
              >
                {recommended.imageUrl ? (
                  <img alt={`${recommended.name} cover art`} loading="lazy" src={recommended.imageUrl} />
                ) : (
                  <span>{recommended.name}</span>
                )}
              </Link>
              <div className="recommended-card__body">
                <h3>
                  <Link to={`/products/${encodeURIComponent(recommended.slug)}`}>{recommended.name}</Link>
                </h3>
                <p className="recommended-card__platforms">
                  {recommended.platforms.length ? recommended.platforms.map(t).join(' · ') : t('Platform details unavailable')}
                </p>
                <p className="recommended-card__regions">
                  {recommended.regions.length ? recommended.regions.map(t).join(' · ') : t('Region details unavailable')}
                </p>
                <div className="recommended-card__price-row">
                  <span>{t('Starting at')}</span>
                  <strong>{formatPrice(recommended.lowestPrice, recommended.currency)}</strong>
                </div>
                <p className="recommended-card__cashback">
                  {t('Cashback')} {recommended.cashbackPercent !== null
                    ? `${recommended.cashbackPercent}%`
                    : t('not specified')}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-panel">{t('No recommended products are available right now.')}</div>
      )}
    </section>
  );
}

function ProductRatingPanel({
  productSlug,
  ratings,
}: {
  productSlug: string;
  ratings: ProductRatings | null;
}) {
  const { language, t } = usePreferences();
  const reviewPath = `/products/${encodeURIComponent(productSlug)}/community-reviews`;
  const reviewResource = useApiResource<CommunityReviews>(reviewPath);
  const auth = useAuth();
  const location = useLocation();
  const [changedReviews, setChangedReviews] = useState<CommunityReviews | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reviews = changedReviews ?? reviewResource.data;
  const userReview = auth.user ? reviews?.userReview ?? null : null;
  const ratingCategories = [
    [t('Gameplay'), ratings?.gameplay ?? null],
    [t('Story'), ratings?.story ?? null],
    [t('Graphics'), ratings?.graphics ?? null],
    [t('Soundtrack'), ratings?.soundtrack ?? null],
  ] as const;

  useEffect(() => {
    setChangedReviews(null);
    setRating(5);
    setReviewText('');
    setEditing(false);
    setConfirmDelete(false);
    setError(null);
    setNotice(null);
  }, [productSlug]);

  function startEditing(review: CommunityReview) {
    setRating(review.rating);
    setReviewText(review.reviewText);
    setEditing(true);
    setConfirmDelete(false);
    setError(null);
    setNotice(null);
  }

  function cancelEditing() {
    setRating(5);
    setReviewText('');
    setEditing(false);
    setConfirmDelete(false);
    setError(null);
    setNotice(null);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.user) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const method = userReview ? 'PATCH' : 'POST';
      const path = userReview ? `${reviewPath}/${userReview.id}` : reviewPath;
      const updated = await apiMutate<CommunityReviews>(
        path,
        method,
        { rating, reviewText },
        auth.csrfToken,
      );
      setChangedReviews(updated);
      setEditing(false);
      setReviewText('');
      setRating(5);
      setNotice(t(userReview ? 'Your review was updated.' : 'Your review was published.'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save your review.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReview() {
    if (!userReview) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiMutate<CommunityReviews>(
        `${reviewPath}/${userReview.id}`,
        'DELETE',
        {},
        auth.csrfToken,
      );
      setChangedReviews(updated);
      setEditing(false);
      setConfirmDelete(false);
      setReviewText('');
      setRating(5);
      setNotice(t('Your review was deleted.'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete your review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="product-ratings-heading" className="product-ratings">
      <div className="product-detail-section-heading">
        <div>
          <p className="eyebrow">{t('PLAYER FEEDBACK')}</p>
          <h2 id="product-ratings-heading">{t('Player ratings and reviews')}</h2>
        </div>
      </div>
      {reviewResource.loading && <p className="product-reviews__message" role="status">{t('Loading player reviews...')}</p>}
      {reviewResource.error && (
        <p className="product-reviews__message product-reviews__message--unavailable" role="alert">
          {t('Reviews could not be loaded.')} {reviewResource.error}
        </p>
      )}
      {reviews && (
        <>
          <div className="community-review-summary">
            <div className="community-review-summary__score">
              <strong>{reviews.summary.averageRating?.toFixed(2) ?? '—'}</strong>
              <span>
                {t('out of 5')} · {reviews.summary.totalReviews.toLocaleString(language === 'lt' ? 'lt-LT' : 'en-US')}{' '}
                {t(reviews.summary.totalReviews === 1 ? 'review' : 'reviews')}
              </span>
            </div>
            <div aria-label={t('Rating distribution')} className="community-review-distribution">
              {([5, 4, 3, 2, 1] as const).map((stars) => {
                const count = reviews.summary.distribution[stars];
                const percentage = reviews.summary.totalReviews > 0
                  ? (count / reviews.summary.totalReviews) * 100
                  : 0;
                return (
                  <div className="community-review-distribution__row" key={stars}>
                    <span>{stars} <span aria-hidden="true">★</span></span>
                    <div
                      aria-label={`${count} ${t(count === 1 ? 'review' : 'reviews')} ${t('with')} ${stars} ${t('stars')}`}
                      className="community-review-distribution__track"
                      role="img"
                    >
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {reviews.demoReviewsIncluded && (
            <p className="community-review-demo-note" role="note">
              {t('Demo reviews are sample content only; they are not customer feedback.')}
            </p>
          )}
          {error && <p className="product-reviews__message product-reviews__message--error" role="alert">{error}</p>}
          {notice && <p className="product-reviews__message" role="status">{notice}</p>}
          {auth.loading ? (
            <p className="product-reviews__message" role="status">{t('Checking your account...')}</p>
          ) : auth.user ? (
            userReview && !editing ? (
              <p className="community-review-manage">
                {t('You have already reviewed this game. Manage it from your review below.')}
              </p>
            ) : (
              <form className="community-review-form" onSubmit={(event) => void submitReview(event)}>
                <h3>{t(userReview ? 'Edit your review' : 'Write a review')}</h3>
                <fieldset className="community-review-form__rating">
                  <legend>{t('Your rating')}</legend>
                  <div>
                    {([1, 2, 3, 4, 5] as const).map((stars) => (
                      <button
                        aria-label={`${stars} ${t(stars === 1 ? 'star' : 'stars')}`}
                        aria-pressed={rating === stars}
                        className={rating >= stars ? 'is-selected' : ''}
                        key={stars}
                        onClick={() => setRating(stars)}
                        type="button"
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor={`community-review-${productSlug}`}>{t('Your review')}</label>
                <textarea
                  id={`community-review-${productSlug}`}
                  maxLength={2000}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder={t('Share your experience with this game...')}
                  required
                  rows={4}
                  value={reviewText}
                />
                <span className="community-review-form__count">{reviewText.length}/2000</span>
                <div className="community-review-form__actions">
                  <button
                    className="button button--primary"
                    disabled={submitting || !auth.csrfToken}
                    type="submit"
                  >
                    {t(submitting ? 'Saving...' : userReview ? 'Save changes' : 'Publish review')}
                  </button>
                  {userReview && (
                    <button className="review-button" onClick={cancelEditing} type="button">
                      {t('Cancel')}
                    </button>
                  )}
                  {userReview && !confirmDelete && (
                    <button
                      className="review-button review-button--danger"
                      disabled={submitting}
                      onClick={() => setConfirmDelete(true)}
                      type="button"
                    >
                      {t('Delete')}
                    </button>
                  )}
                  {userReview && confirmDelete && (
                    <div className="community-review-form__confirm" role="group" aria-label={t('Confirm review deletion')}>
                      <span>{t('Delete this review?')}</span>
                      <button
                        className="review-button review-button--danger"
                        disabled={submitting}
                        onClick={() => void deleteReview()}
                        type="button"
                      >
                        {t('Confirm delete')}
                      </button>
                      <button className="review-button" onClick={() => setConfirmDelete(false)} type="button">
                        {t('Keep review')}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            )
          ) : (
            <div className="community-review-signin">
              <span>{t('Sign in to rate this game and write a review.')}</span>
              <Link
                className="button button--primary"
                state={{ from: location.pathname }}
                to="/login"
              >
                {t('Sign in')}
              </Link>
            </div>
          )}
          <div aria-label={t('Player reviews')} className="community-review-list">
            {reviews.reviews.length === 0 ? (
              <p className="product-reviews__message">{t('No reviews yet. Be the first to share your experience.')}</p>
            ) : reviews.reviews.map((review) => (
              <article className="community-review" key={review.id}>
                <div className="community-review__header">
                  <div>
                    <strong>{review.userName}</strong>
                    {auth.user && review.isMine && (
                      <span className="community-review__you">{t('Your review')}</span>
                    )}
                    {review.isDemo && <span className="community-review__demo">{t('Demo review')}</span>}
                  </div>
                  <time dateTime={review.createdAt.replace(' ', 'T')}>
                    {formatCommunityReviewDate(review.createdAt, language)}
                  </time>
                </div>
                <div aria-label={`${review.rating} out of 5 stars`} className="community-review__stars">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </div>
                <p className="community-review__text">{review.reviewText}</p>
                {review.updatedAt !== review.createdAt && (
                  <span className="community-review__edited">{t('Edited')} {formatCommunityReviewDate(review.updatedAt, language)}</span>
                )}
                {auth.user && review.isMine && !editing && (
                  <div className="community-review__actions">
                    <button className="review-button" onClick={() => startEditing(review)} type="button">
                      {t('Edit')}
                    </button>
                    <button
                      className="review-button review-button--danger"
                      onClick={() => {
                        startEditing(review);
                        setConfirmDelete(true);
                      }}
                      type="button"
                    >
                      {t('Delete')}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <div className="product-ratings__categories">
        <p className="product-ratings__categories-heading">{t('Game category ratings')}</p>
        {ratingCategories.map(([name, value]) => (
          <div className="product-rating" key={name}>
            <div className="product-rating__label">
              <span>{name}</span>
              <strong>{value !== null ? `${value.toFixed(2)} / 5` : t('Not rated')}</strong>
            </div>
            <div
              aria-label={value !== null ? `${name}: ${value} out of 5` : `${name}: no rating data`}
              className="product-rating__bar"
              role="img"
            >
              <span style={{ width: value !== null ? `${Math.max(0, Math.min(100, value * 20))}%` : '0%' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatCommunityReviewDate(value: string, language: Language = 'en'): string {
  const date = new Date(value.replace(' ', 'T'));
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(language === 'lt' ? 'lt-LT' : 'en-GB', {
    dateStyle: 'medium',
  }).format(date);
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending_payment':
      return 'Pending payment';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function paymentStatusLabel(status: AccountOrderHistory['orders'][number]['paymentStatus']): string {
  switch (status) {
    case 'succeeded':
      return 'Succeeded';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    default:
      return 'Not recorded';
  }
}

function ProductDescription({
  productName,
  sections,
  summary,
}: {
  productName: string;
  sections: ProductDescriptionSection[];
  summary: string;
}) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);

  if (sections.length === 0) {
    return (
      <section aria-labelledby="product-description-heading" className="product-long-description">
        <div className="product-detail-section-heading">
          <div>
            <p className="eyebrow">{t('ABOUT THIS GAME')}</p>
            <h2 id="product-description-heading">{productName}</h2>
          </div>
        </div>
        <p>{summary}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="product-description-heading" className="product-long-description">
      <div className="product-detail-section-heading">
        <div>
          <p className="eyebrow">{t('ABOUT THIS GAME')}</p>
          <h2 id="product-description-heading">{productName}</h2>
        </div>
      </div>
      <div className={`product-long-description__content${expanded ? ' is-expanded' : ''}`}>
        {sections.map((section) => (
          <article key={section.id}>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </div>
      {sections.length > 2 && (
        <button
          aria-expanded={expanded}
          className="product-long-description__toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {t(expanded ? 'Read less' : 'Read more')}
        </button>
      )}
    </section>
  );
}

function ProductInformation({
  metadata,
  platforms,
}: {
  metadata: ProductDetails['metadata'];
  platforms: string[];
}) {
  const { t } = usePreferences();
  const rows = [
    ['Language', metadata.languages.length ? metadata.languages.join(', ') : null],
    ['Release date', metadata.releaseDate],
    ['Publisher', metadata.publisher],
    ['Developer', metadata.developer],
    ['Genre', metadata.genres.length ? metadata.genres.join(', ') : null],
    ['Available platforms', platforms.length ? platforms.join(', ') : null],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1].length > 0);

  return (
    <section aria-labelledby="product-information-heading" className="product-information">
      <div className="product-detail-section-heading">
        <div>
          <p className="eyebrow">{t('PRODUCT FACTS')}</p>
          <h2 id="product-information-heading">{t('Additional information')}</h2>
        </div>
      </div>
      {rows.length ? (
        <dl className="product-information__list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="product-information__empty">{t('No additional product information is available.')}</p>
      )}
    </section>
  );
}

function ProductPage() {
  const { formatPrice, t } = usePreferences();
  const { slug = '' } = useParams();
  const resource = useApiResource<ProductDetails>(
    `/products/${encodeURIComponent(slug)}`,
  );
  const { items, addOffer } = useCart();
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [failedMediaIds, setFailedMediaIds] = useState<number[]>([]);
  const [cartNotice, setCartNotice] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const product = resource.data;

  useEffect(() => {
    setSelectedMediaId(null);
    setFailedMediaIds([]);
    setCartNotice('');
    setLightboxOpen(false);
  }, [slug]);

  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!dialog) return;

    if (lightboxOpen && !dialog.open) dialog.showModal();
    if (!lightboxOpen && dialog.open) dialog.close();
  }, [lightboxOpen]);

  if (resource.loading) {
    return (
      <main className="page-main page-main--catalog" id="main-content">
        <div className="site-width">
          <div className="notice-card" role="status">{t('Loading product details...')}</div>
        </div>
      </main>
    );
  }

  if (resource.error || !product) {
    return (
      <main className="page-main page-main--catalog" id="main-content">
        <div className="site-width">
          <div className="notice-card notice-card--error" role="alert">
            {resource.error ?? t('Product not found.')}
            <p><Link to="/store">{t('Return to the store')}</Link></p>
          </div>
        </div>
      </main>
    );
  }

  const gallery = product.gallery.length > 0
    ? product.gallery.filter((media) => !failedMediaIds.includes(media.id))
    : product.imageUrl && !failedMediaIds.includes(-product.id)
      ? [{
          id: -product.id,
          mediaType: 'cover' as const,
          imageUrl: product.imageUrl,
          thumbnailUrl: product.imageUrl,
          altText: `${product.name} cover art`,
        }]
      : [];
  const selectedMedia =
    gallery.find((media) => media.id === selectedMediaId) ?? gallery[0] ?? null;
  const bestOffer = product.offers[0] ?? null;
  const bestOfferInCart = bestOffer
    ? items.some((item) => item.offer.id === bestOffer.id)
    : false;
  const bestOfferDiscount = bestOffer?.regularPrice && bestOffer.regularPrice > bestOffer.price
    ? Math.round((1 - bestOffer.price / bestOffer.regularPrice) * 100)
    : null;

  function addSelectedOffer(productDetails: ProductDetails, offer: ProductOffer) {
    addOffer(productDetails, offer);
    setCartNotice(`${offer.sellerName}'s offer was added to your cart.`);
  }

  return (
    <main className="page-main page-main--catalog product-detail-page" id="main-content">
      <div className="site-width">
        <nav aria-label={t('Breadcrumb')} className="product-breadcrumb">
          <Link to="/">{t('Home')}</Link>
          <span aria-hidden="true">/</span>
          <Link to="/store">{t('Games')}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="product-page-layout">
          <section aria-labelledby="product-title" className="product-detail">
            <div className="product-detail__art" data-media-type={selectedMedia?.mediaType ?? 'cover'}>
              {selectedMedia ? (
                <button
                  aria-label={t('Open image full screen')}
                  className="product-detail__art-button"
                  onClick={() => setLightboxOpen(true)}
                  type="button"
                >
                  <img
                    alt={selectedMedia.altText}
                    onError={() => setFailedMediaIds((current) =>
                      current.includes(selectedMedia.id) ? current : [...current, selectedMedia.id],
                    )}
                    src={selectedMedia.imageUrl}
                  />
                </button>
              ) : (
                <div aria-hidden="true" className="cover-art cover-art--fallback">
                  <span className="cover-art__category">{product.category}</span>
                  <span className="cover-art__title">{product.name}</span>
                  <span className="cover-art__edition">Artwork unavailable</span>
                </div>
              )}
            </div>
            <div className="product-detail__content">
              <p className="eyebrow">{t(product.category)} · {t('DIGITAL GAME')}</p>
              <h1 id="product-title">{product.name}</h1>
              <p className="product-detail__description">{product.description}</p>
              <div className="product-detail__facts">
                <div className="product-fact">
                  <span aria-hidden="true" className="product-fact__icon">✓</span>
                  <div>
                    <strong>{t('Available regions')}</strong>
                    <span>{product.regions.length ? product.regions.map(t).join(', ') : t('Check seller offer')}</span>
                  </div>
                </div>
                <div className="product-fact">
                  <span aria-hidden="true" className="product-fact__icon">PC</span>
                  <div>
                    <strong>{t('Platforms')}</strong>
                    <span>{product.platforms.length ? product.platforms.map(t).join(', ') : t('Check seller offer')}</span>
                  </div>
                </div>
                <div className="product-fact">
                  <span aria-hidden="true" className="product-fact__icon">KEY</span>
                  <div>
                    <strong>{t('Digital format')}</strong>
                    <span>{t("Digital game listing; review each seller's platform and region details.")}</span>
                  </div>
                </div>
                <div className="product-fact">
                  <span aria-hidden="true" className="product-fact__icon">↔</span>
                  <div>
                    <strong>{t('Compare sellers')}</strong>
                    <span>{product.offers.length} {t('active')} {t(product.offers.length === 1 ? 'offer' : 'offers')} {t('to compare')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside aria-label={t('Best available offer')} className="product-buy-panel">
            <div className="product-buy-panel__heading">
              <span className="product-buy-panel__mark" aria-hidden="true">
                <GamepadIcon />
              </span>
              <div>
                <strong>{t('Gamebay offers')}</strong>
                <span>{product.offers.length} {t('seller')} {t(product.offers.length === 1 ? 'offer' : 'offers')}</span>
              </div>
            </div>
            {bestOffer ? (
              <>
                <p className="product-buy-panel__label">{t('BEST AVAILABLE PRICE')}</p>
                <div className="product-buy-panel__price">
                  {bestOfferDiscount !== null && <span>-{bestOfferDiscount}%</span>}
                  <strong>{formatPrice(bestOffer.price, bestOffer.currency)}</strong>
                </div>
                {typeof bestOffer.regularPrice === 'number' && bestOffer.regularPrice > bestOffer.price && (
                  <del className="product-buy-panel__regular-price">
                    {formatPrice(bestOffer.regularPrice, bestOffer.currency)}
                  </del>
                )}
                <div className="product-buy-panel__seller">
                  {t('Best offer from')} <strong>{bestOffer.sellerName}</strong>
                </div>
                <div className="product-buy-panel__variant">
                  <span>{bestOffer.platform}</span>
                  <span>{bestOffer.region}</span>
                </div>
                <button
                  className="button button--primary product-buy-panel__button"
                  onClick={() => addSelectedOffer(product, bestOffer)}
                  type="button"
                >
                  {t(bestOfferInCart ? 'Add another to cart' : 'Add best offer to cart')}
                </button>
                <a className="product-buy-panel__compare" href="#seller-offers">
                  {t('Compare all offers')} ({product.offers.length})
                </a>
              </>
            ) : (
              <p className="product-buy-panel__unavailable">{t('No active offers are available right now.')}</p>
            )}
            <div className="product-buy-panel__notice">
              <strong>{t('Marketplace demo')}</strong>
              <span>{t("Checkout is simulated with no real charge. Confirm the selected offer's platform and region before purchase.")}</span>
            </div>
          </aside>

          <section aria-label={`${product.name} game images`} className="product-gallery">
            <div className="product-gallery__heading">
              <div>
                <p className="eyebrow">{t('SEE THE GAME')}</p>
                <h2>{t('Game gallery')}</h2>
              </div>
              <span>{gallery.length} images</span>
            </div>
            <div className="product-gallery__track">
              {gallery.map((media, index) => {
                const label = media.mediaType === 'cover' ? t('cover art') : `${t('game screenshot')} ${index}`;
                return (
                  <button
                    aria-label={`${t('Show')} ${label} ${t('for')} ${product.name}`}
                    aria-pressed={selectedMedia?.id === media.id}
                    className={`product-gallery__thumbnail${selectedMedia?.id === media.id ? ' is-selected' : ''}`}
                    key={media.id}
                    onClick={() => {
                      setSelectedMediaId(media.id);
                      setLightboxOpen(true);
                    }}
                    type="button"
                  >
                    <img
                      alt=""
                      loading="lazy"
                      onError={() => setFailedMediaIds((current) =>
                        current.includes(media.id) ? current : [...current, media.id],
                      )}
                      src={media.thumbnailUrl}
                    />
                    <span>{media.mediaType === 'cover' ? t('Cover art') : `${t('Screenshot')} ${index}`}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside aria-label={t('Important purchase information')} className="product-important">
            <span aria-hidden="true" className="product-important__icon">!</span>
            <div>
              <strong>{t('Important purchase information')}</strong>
              <p>
                {t("Digital offers can differ by platform and region. Confirm the selected seller's offer details before adding it to your cart.")}
              </p>
            </div>
          </aside>

          <section aria-labelledby="product-offers-heading" className="product-offers" id="seller-offers">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('COMPARE PRICES')}</p>
                <h2 id="product-offers-heading">{t('Available versions and offers')}</h2>
                <p className="product-offers__subtitle">
                {t('Compare editions, platform, region, seller, and price before choosing.')}
                </p>
              </div>
              <span className="product-offers__count">{product.offers.length} {t('available')}</span>
            </div>

            {cartNotice && <p aria-live="polite" className="cart-notice">{cartNotice}</p>}

            {product.offers.length > 0 ? (
              <div className="product-offer-list">
                {product.offers.map((offer, index) => {
                  const inCart = items.some((item) => item.offer.id === offer.id);
                  return (
                    <article className="product-offer" key={offer.id}>
                      <div className="product-offer__seller">
                        <span aria-hidden="true" className="product-offer__seller-mark">
                          {offer.sellerName.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <span className="product-offer__label">{t('Seller')}</span>
                          <strong>{offer.sellerName}</strong>
                          {index === 0 && <span className="product-offer__best">{t('Best price')}</span>}
                        </div>
                      </div>
                      <div className="product-offer__specs">
                        <span>{offer.platform}</span>
                        <span>{offer.region}</span>
                      </div>
                      <div className="product-offer__price">
                        <span className="product-offer__label">{t('Price')}</span>
                        {typeof offer.regularPrice === 'number' && offer.regularPrice > offer.price && (
                          <del>{formatPrice(offer.regularPrice, offer.currency)}</del>
                        )}
                        <strong>{formatPrice(offer.price, offer.currency)}</strong>
                      </div>
                      <button
                        aria-label={`${t(inCart ? 'Add another' : 'Add')} ${product.name} ${t('offer from')} ${offer.sellerName} ${t('to cart')}`}
                        className="button button--primary product-offer__button"
                        onClick={() => addSelectedOffer(product, offer)}
                        type="button"
                      >
                        {t(inCart ? 'Add another' : 'Add to cart')}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel" role="status">
                <h2>{t('No seller offers available')}</h2>
                <p>{t('There are no active offers for this game at the moment. Please check back later.')}</p>
              </div>
            )}
          </section>
        </div>
        {selectedMedia && (
          <dialog
            aria-label={`${product.name} ${t('image viewer')}`}
            className="product-lightbox"
            onClick={(event) => {
              if (event.target === event.currentTarget) setLightboxOpen(false);
            }}
            onClose={() => setLightboxOpen(false)}
            ref={lightboxRef}
          >
            <div className="product-lightbox__content">
              <button
                autoFocus
                aria-label={t('Close image viewer')}
                className="product-lightbox__close"
                onClick={() => setLightboxOpen(false)}
                type="button"
              >
                ×
              </button>
              <img alt={selectedMedia.altText} src={selectedMedia.imageUrl} />
              <p>{product.name} · {selectedMedia.altText}</p>
            </div>
          </dialog>
        )}
        <div className="product-detail-extras">
          <RecommendedProducts products={product.recommendations} />
          <ProductRatingPanel
            key={product.slug}
            productSlug={product.slug}
            ratings={product.ratings}
          />
          <ProductDescription
            key={product.id}
            productName={product.name}
            sections={product.descriptionSections}
            summary={product.description}
          />
          <ProductInformation metadata={product.metadata} platforms={product.platforms} />
        </div>
      </div>
    </main>
  );
}

function CartPage() {
  const { formatPrice, t } = usePreferences();
  const { items, removeOffer, setQuantity } = useCart();
  const auth = useAuth();
  const cartTotals = Array.from(
    items.reduce((totals, item) => {
      const currency = item.offer.currency;
      totals.set(
        currency,
        (totals.get(currency) ?? 0) + item.offer.price * item.quantity,
      );
      return totals;
    }, new Map<string, number>()),
    ([currency, total]) => formatPrice(total, currency),
  );

  if (items.length > 0) {
    return (
      <main className="page-main page-main--catalog cart-page" id="main-content">
        <div className="site-width">
          <div className="page-intro">
            <p className="eyebrow">{t('YOUR CART')}</p>
            <h1>{t('Review your offers')}</h1>
            <p>{t('Each item keeps the seller and offer you selected.')}</p>
          </div>
          <div className="cart-layout">
            <div className="cart-items">
              {items.map(({ product, offer, quantity }) => (
                <article className="cart-item" key={offer.id}>
                  <Link className="cart-item__art" to={`/products/${encodeURIComponent(product.slug)}`}>
                    {product.imageUrl
                      ? <img alt="" loading="lazy" src={product.imageUrl} />
                      : <span>{product.name}</span>}
                  </Link>
                  <div className="cart-item__details">
                    <Link className="cart-item__name" to={`/products/${encodeURIComponent(product.slug)}`}>
                      {product.name}
                    </Link>
                    <p>{offer.sellerName} · {offer.platform} · {offer.region}</p>
                    <span>{t('Offer')} #{offer.id} · {formatPrice(offer.price, offer.currency)} {t('each')}</span>
                    <label className="cart-item__quantity">
                      {t('Quantity')}
                      <input
                        aria-label={`${t('Quantity for')} ${product.name}`}
                        min={1}
                        onChange={(event) => setQuantity(offer.id, Number(event.target.value))}
                        step={1}
                        type="number"
                        value={quantity}
                      />
                    </label>
                  </div>
                  <div className="cart-item__total">
                    <strong>{formatPrice(offer.price * quantity, offer.currency)}</strong>
                    <button
                      className="cart-item__remove"
                      onClick={() => removeOffer(offer.id)}
                      type="button"
                    >
                      {t('Remove')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <aside aria-label={t('Cart summary')} className="cart-summary">
              <h2>{t('Order summary')}</h2>
              <p><span>{t('Items')}</span><strong>{items.reduce((count, item) => count + item.quantity, 0)}</strong></p>
              <p className="cart-summary__total">
                <span>{t('Total')}</span>
                <strong>{cartTotals.join(' + ')}</strong>
              </p>
              <Link className="button button--primary" to="/checkout">
                {t(auth.user ? 'Continue to checkout' : 'Sign in to checkout')}
              </Link>
              <p className="cart-summary__note">
                {t('Checkout requires an account. Payment is simulated; no real charge is made.')}
              </p>
            </aside>
          </div>
          <Link className="cart-continue" to="/store">{t('Continue browsing games')}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main page-main--catalog cart-page" id="main-content">
      <div className="site-width">
        <div className="empty-panel empty-panel--center">
          <span aria-hidden="true" className="empty-panel__icon"><BagIcon /></span>
          <p className="eyebrow">{t('YOUR CART')}</p>
          <h1>{t('Your next game goes here')}</h1>
          <p>{t('Your cart is empty for now. Take a look around and find something you love.')}</p>
          <Link className="button button--primary" to="/store">
            {t('Browse games')}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <main className="page-main page-main--compact page-main--catalog" id="main-content">
        <LoadingStatus>{t('Checking your sign-in...')}</LoadingStatus>
      </main>
    );
  }
  if (auth.error) {
    return (
      <main className="page-main page-main--compact page-main--catalog" id="main-content">
        <div className="notice-card notice-card--error" role="alert">
          <p>{auth.error}</p>
          <button className="review-button" onClick={() => void auth.refresh()} type="button">
            {t('Retry')}
          </button>
        </div>
      </main>
    );
  }
  if (!auth.user) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/login"
      />
    );
  }

  return children;
}

function AccountPage() {
  const { language, t } = usePreferences();
  const [retryCount, setRetryCount] = useState(0);
  const account = useApiResource<AccountProfile>(`/account?retry=${retryCount}`);

  return (
    <main className="page-main page-main--catalog account-page" id="main-content">
      <div className="site-width">
        <div className="page-intro">
          <p className="eyebrow">{t('YOUR GAMEBAY')}</p>
          <h1>{t('Account')}</h1>
          <p>{t('Manage your account details and find your previous purchases.')}</p>
        </div>
        {account.loading && <LoadingStatus>{t('Loading your account...')}</LoadingStatus>}
        {account.error && (
          <div className="notice-card notice-card--error" role="alert">
            <p>{account.error}</p>
            <button
              className="review-button"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              {t('Try again')}
            </button>
          </div>
        )}
        {account.data && (
          <section aria-labelledby="account-details-heading" className="account-panel">
            <div>
              <p className="eyebrow">{t('ACCOUNT DETAILS')}</p>
              <h2 id="account-details-heading">{account.data.name}</h2>
              <dl className="account-details">
                <div>
                  <dt>{t('Email address')}</dt>
                  <dd>{account.data.email}</dd>
                </div>
                <div>
                  <dt>{t('Member since')}</dt>
                  <dd>{formatCommunityReviewDate(account.data.createdAt, language)}</dd>
                </div>
              </dl>
            </div>
            <div className="account-panel__actions">
              <Link className="button button--primary" to="/orders">{t('View order history')}</Link>
              <Link className="review-button" to="/store">{t('Browse games')}</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function OrderHistoryPage() {
  const { formatPrice, language, t } = usePreferences();
  const [retryCount, setRetryCount] = useState(0);
  const history = useApiResource<AccountOrderHistory>(`/account/orders?retry=${retryCount}`);

  return (
    <main className="page-main page-main--catalog account-page" id="main-content">
      <div className="site-width">
        <div className="page-intro">
          <p className="eyebrow">{t('YOUR PURCHASES')}</p>
          <h1>{t('Order history')}</h1>
          <p>{t('Payment status, purchased offers, and any delivered digital keys.')}</p>
        </div>
        {history.loading && <LoadingStatus>{t('Loading your orders...')}</LoadingStatus>}
        {history.error && (
          <div className="notice-card notice-card--error" role="alert">
            <p>{history.error}</p>
            <button
              className="review-button"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              {t('Try again')}
            </button>
          </div>
        )}
        {history.data && history.data.orders.length === 0 && (
          <div className="empty-panel empty-panel--center">
            <p className="eyebrow">{t('NO ORDERS YET')}</p>
            <h2>{t('Your order history is empty')}</h2>
            <p>{t('Your purchases, payment status, and any delivered keys will appear here.')}</p>
            <Link className="button button--primary" to="/store">{t('Browse games')}</Link>
          </div>
        )}
        {history.data && history.data.orders.length > 0 && (
          <div aria-label={t('Your orders')} className="account-order-list">
            {history.data.orders.map((order) => (
              <article className="account-order" key={order.id}>
                <header className="account-order__header">
                  <div>
                    <p className="eyebrow">ORDER #{order.id}</p>
                    <time dateTime={order.createdAt.replace(' ', 'T')}>
                      {formatCommunityReviewDate(order.createdAt, language)}
                    </time>
                  </div>
                  <div className="account-order__total">
                    <div aria-label="Order and payment status" className="account-order__statuses">
                      <p>
                        <span>{t('Order')}</span>
                        <strong className={`order-status order-status--${order.status}`}>
                          {t(orderStatusLabel(order.status))}
                        </strong>
                      </p>
                      <p>
                        <span>{t('Payment')}</span>
                        <strong className={`order-status order-status--${order.paymentStatus ?? 'none'}`}>
                          {t(paymentStatusLabel(order.paymentStatus))}
                        </strong>
                      </p>
                    </div>
                    <strong className="account-order__amount">
                      {formatPrice(order.total, order.currency)}
                    </strong>
                  </div>
                </header>
                <div className="account-order__items">
                  {order.items.map((item) => (
                    <section className="account-order-item" key={item.id}>
                      <div className="account-order-item__details">
                        <Link to={`/products/${encodeURIComponent(item.slug)}`}>
                          {item.productName}
                        </Link>
                        <span>
                          {item.sellerName} · {t('Qty')} {item.quantity} ·{' '}
                          {formatPrice(item.unitPrice, order.currency)} {t('each')}
                        </span>
                      </div>
                      {item.digitalKeys.length > 0 && (
                        <div className="account-order-item__keys">
                          <strong>
                            {item.digitalKeys.length === 1 ? t('Digital key') : t('Digital keys')} ({t('demo only, not redeemable')})
                          </strong>
                          {item.digitalKeys.map((key, index) => (
                            <code key={`${item.id}-${index}`}>{key.value}</code>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CheckoutPage() {
  const { formatPrice, t } = usePreferences();
  const cart = useCart();
  const auth = useAuth();
  const [requestId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const totals = Array.from(
    cart.items.reduce((amounts, item) => {
      amounts.set(
        item.offer.currency,
        (amounts.get(item.offer.currency) ?? 0) + item.offer.price * item.quantity,
      );
      return amounts;
    }, new Map<string, number>()),
    ([currency, amount]) => ({ currency, amount }),
  );
  const hasOneCurrency = totals.length <= 1;

  async function completePurchase() {
    if (cart.items.length === 0 || !hasOneCurrency || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const checkoutResult = await apiMutate<CheckoutResult>(
        '/checkout/simulate-payment',
        'POST',
        {
          requestId,
          items: cart.items.map(({ offer, quantity }) => ({
            offerId: offer.id,
            quantity,
          })),
        },
        auth.csrfToken,
      );
      setResult(checkoutResult);
      cart.clearCart();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('We could not complete the simulated payment. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-main page-main--catalog checkout-page" id="main-content">
      <div className="site-width">
        <div className="page-intro">
          <p className="eyebrow">{t('DEMO CHECKOUT')}</p>
          <h1>{t('Review and complete your order')}</h1>
          <p>{t('Only your selected seller offers will be purchased.')}</p>
        </div>
        {result ? (
          <section aria-live="polite" className="checkout-result" role="status">
            <p className="eyebrow">{t('PAYMENT SIMULATED SUCCESSFULLY')}</p>
            <h2>{t('Your order is complete')}</h2>
            <p>
              {t('Order')} #{result.orderId} · {formatPrice(result.total, result.currency)}.
              {t('No real payment was taken.')}
            </p>
            <p>{t('Your digital keys are available in your order history.')}</p>
            <Link className="button button--primary" to="/orders">{t('View order and digital keys')}</Link>
          </section>
        ) : cart.items.length === 0 ? (
          <div className="empty-panel empty-panel--center">
            <p className="eyebrow">{t('NOTHING TO CHECK OUT')}</p>
            <h2>{t('Your cart is empty')}</h2>
            <p>{t('Add a seller offer to your cart before continuing.')}</p>
            <Link className="button button--primary" to="/store">{t('Browse games')}</Link>
          </div>
        ) : (
          <div className="checkout-layout">
            <section aria-label={t('Items in your order')} className="checkout-items">
              {cart.items.map(({ product, offer, quantity }) => (
                <article className="checkout-item" key={offer.id}>
                  <Link
                    aria-label={`${t('View')} ${product.name}`}
                    className="checkout-item__art"
                    to={`/products/${encodeURIComponent(product.slug)}`}
                  >
                    {product.imageUrl
                      ? <img alt="" loading="lazy" src={product.imageUrl} />
                      : <span>{product.name}</span>}
                  </Link>
                  <div className="checkout-item__details">
                    <h2>{product.name}</h2>
                    <p>{offer.sellerName} · {offer.platform} · {offer.region}</p>
                    <span>{t('Offer')} #{offer.id} · {t('Qty')} {quantity} · {formatPrice(offer.price, offer.currency)} {t('each')}</span>
                  </div>
                  <strong className="checkout-item__total">
                    {formatPrice(offer.price * quantity, offer.currency)}
                  </strong>
                </article>
              ))}
            </section>
            <aside aria-label={t('Checkout summary')} className="checkout-summary">
              <h2>{t('Order summary')}</h2>
              <p>
                <span>{t('Items')}</span>
                <strong>{cart.items.reduce((count, item) => count + item.quantity, 0)}</strong>
              </p>
              {totals.map(({ currency, amount }) => (
                <p className="checkout-summary__total" key={currency}>
                  <span>{t('Total')}</span>
                  <strong>{formatPrice(amount, currency)}</strong>
                </p>
              ))}
              {!hasOneCurrency && (
                <p className="checkout-error" role="alert">
                  {t('Checkout requires all selected offers to use one currency. Remove items from different currencies in your cart.')}
                </p>
              )}
              {error && <p className="checkout-error" role="alert">{error}</p>}
              <button
                className="button button--primary"
                disabled={submitting || !hasOneCurrency}
                onClick={() => void completePurchase()}
                type="button"
              >
                {t(submitting ? 'Processing demo payment...' : 'Complete simulated purchase')}
              </button>
              <p className="checkout-summary__note">
                {t('Demo only. This button simulates an approved payment; no card details or real money are used. Order creation and key assignment succeed or roll back together.')}
              </p>
              <Link className="cart-continue" to="/cart">{t('Return to cart')}</Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function NotFoundPage() {
  const { t } = usePreferences();
  return (
    <main className="page-main page-main--compact" id="main-content">
      <div className="empty-panel empty-panel--center">
        <p className="eyebrow">{t('PAGE NOT FOUND')}</p>
        <h1>{t('Looks like a wrong turn.')}</h1>
        <Link className="button button--primary" to="/">
          {t('Back to home')}
        </Link>
      </div>
    </main>
  );
}

function Footer() {
  const { t } = usePreferences();

  return (
    <footer className="site-footer">
      <div className="site-width">
        <div className="footer-main">
          <div className="footer-brand">
            <Link aria-label="Gamebay home" className="brand brand--footer" to="/">
              <span aria-hidden="true" className="brand__mark">
                <GamepadIcon />
              </span>
              <span className="brand__name">
                game<span>bay</span>
              </span>
            </Link>
            <p>{t('A little corner of the internet for your next favorite game.')}</p>
          </div>
          <div className="footer-column">
            <h2>{t('Discover')}</h2>
            <Link to="/store">{t('Browse games')}</Link>
            <Link to="/#deals">{t('Deals')}</Link>
            <Link to="/">{t('Home')}</Link>
          </div>
          <div className="footer-column">
            <h2>{t('Your account')}</h2>
            <Link to="/register">{t('Sign in or register')}</Link>
            <Link to="/account">{t('Account')}</Link>
            <Link to="/orders">{t('Order history')}</Link>
            <Link to="/cart">{t('Shopping cart')}</Link>
          </div>
          <div className="footer-note">
            <span className="footer-note__badge">{t('DEMO MARKETPLACE')}</span>
            <p>{t('Example listings only. No real payment is processed on this site.')}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Gamebay. {t('Built as a marketplace demo.')}</span>
          <span>{t('Made for players, wherever they play.')}</span>
        </div>
        <p className="footer-artwork-note">
          Game artwork is served from the Steam and Microsoft Stores and remains the property of its
          respective publishers. Gamebay is not affiliated with Valve, Steam, or Microsoft.{' '}
          <a href="https://store.steampowered.com/" rel="noreferrer" target="_blank">
            Steam Store
          </a>
          {' · '}
          <a href="https://www.microsoft.com/store" rel="noreferrer" target="_blank">
            Microsoft Store
          </a>
        </p>
      </div>
    </footer>
  );
}

function App() {
  const location = useLocation();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() =>
    window.localStorage.getItem('gamebay-language') === 'lt' ? 'lt' : 'en',
  );
  const [currency, setCurrency] = useState<DisplayCurrency>(() =>
    window.localStorage.getItem('gamebay-currency') === 'USD' ? 'USD' : 'EUR',
  );
  const authLoadStarted = useRef(false);

  const t = useCallback(
    (text: string) => (language === 'lt' ? lithuanianTranslations[text] ?? text : text),
    [language],
  );
  const formatPrice = useCallback(
    (value: number, sourceCurrency: string) => {
      let displayValue = value;
      if (sourceCurrency === 'EUR' && currency === 'USD') {
        displayValue *= EUR_TO_USD_DEMO_RATE;
      } else if (sourceCurrency === 'USD' && currency === 'EUR') {
        displayValue /= EUR_TO_USD_DEMO_RATE;
      }

      const locale = language === 'lt' ? 'lt-LT' : currency === 'USD' ? 'en-US' : 'en-IE';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(displayValue);
    },
    [currency, language],
  );
  const convertPriceToEur = useCallback(
    (value: string) => {
      if (!value || currency === 'EUR') return value;
      const amount = Number(value);
      return Number.isFinite(amount)
        ? (amount / EUR_TO_USD_DEMO_RATE).toFixed(2)
        : value;
    },
    [currency],
  );

  useEffect(() => {
    window.localStorage.setItem('gamebay-language', language);
    window.localStorage.setItem('gamebay-currency', currency);
    document.documentElement.lang = language;
  }, [currency, language]);

  useEffect(() => {
    if (location.hash) return scrollToSectionWhenAvailable(location.hash.slice(1));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.hash, location.key, location.pathname, location.search]);

  const saveAuthSession = useCallback((session: AuthSession) => {
    setAuthSession(session);
    setAuthLoading(false);
    setAuthError(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      saveAuthSession(await apiGet<AuthSession>('/auth/me'));
    } catch (requestError) {
      setAuthSession(null);
      setAuthLoading(false);
      setAuthError(
        requestError instanceof Error ? requestError.message : 'Unable to verify your account.',
      );
    }
  }, [saveAuthSession]);

  useEffect(() => {
    if (authLoadStarted.current) return;
    authLoadStarted.current = true;
    void refreshAuth();
  }, [refreshAuth]);

  function addOffer(product: ProductDetails, offer: ProductOffer) {
    setCartItems((current) => {
      const existing = current.find((item) => item.offer.id === offer.id);
      if (existing) {
        return current.map((item) =>
          item.offer.id === offer.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          product: { slug: product.slug, name: product.name, imageUrl: product.imageUrl },
          offer,
          quantity: 1,
        },
      ];
    });
  }

  function removeOffer(offerId: number) {
    setCartItems((current) => current.filter((item) => item.offer.id !== offerId));
  }

  function setQuantity(offerId: number, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setCartItems((current) =>
      current.map((item) =>
        item.offer.id === offerId ? { ...item, quantity } : item,
      ),
    );
  }

  const authValue: AuthContextValue = {
    user: authSession?.user ?? null,
    csrfToken: authSession?.csrfToken ?? '',
    loading: authLoading,
    error: authError,
    setSession: saveAuthSession,
    refresh: refreshAuth,
  };
  const preferencesValue: PreferencesContextValue = {
    language,
    currency,
    setLanguage,
    setCurrency,
    t,
    formatPrice,
    convertPriceToEur,
  };
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <PreferencesContext.Provider value={preferencesValue}>
      <AuthContext.Provider value={authValue}>
        <CartContext.Provider
          value={{
            items: cartItems,
            addOffer,
            setQuantity,
            removeOffer,
            clearCart: () => setCartItems([]),
          }}
        >
          <div className={`app-shell${isAuthPage ? ' app-shell--auth' : ''}`}>
            {!isAuthPage && <Header />}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/products/:slug" element={<ProductPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/cart" element={<CartPage />} />
              <Route
                path="/account"
                element={<ProtectedRoute><AccountPage /></ProtectedRoute>}
              />
              <Route
                path="/orders"
                element={<ProtectedRoute><OrderHistoryPage /></ProtectedRoute>}
              />
              <Route
                path="/checkout"
                element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            {!isAuthPage && <Footer />}
          </div>
        </CartContext.Provider>
      </AuthContext.Provider>
    </PreferencesContext.Provider>
  );
}

export default App;
