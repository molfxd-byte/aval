export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
  children?: NavItem[];
}

export interface FastPayment {
  id: string;
  title: string;
  image: string;
  imageClass?: string;
  href: string;
  isNew?: boolean;
}

export interface PaymentMethod {
  id: string;
  title: string;
  description: string;
  image: string;
  logoClass: 'aval-group-logo' | 'pse-logo' | 'visa-logo' | 'bre-b-logo';
}

export interface BenefitSlide {
  id: string;
  subtitle: string;
  text: string;
  images: {
    full: string;
    halfTop: string;
    halfBottom: string;
  };
}

export interface NewsSlide {
  id: string;
  title: string;
  text: string;
  image: string;
  buttonLabel: string;
  href: string;
}

export interface FooterLink {
  label: string;
  href: string;
}
