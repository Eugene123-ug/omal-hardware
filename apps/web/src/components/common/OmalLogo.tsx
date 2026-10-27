import React from 'react';
import { CompanyLogo } from './CompanyLogo';

interface OmalLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
}

export const OmalLogo: React.FC<OmalLogoProps> = (props) => {
  return <CompanyLogo {...props} />;
};

export default OmalLogo;
