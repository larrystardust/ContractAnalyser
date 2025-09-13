import React from 'react';
import { Helmet } from 'react-helmet-async';

interface StructuredDataProps {
  schema: Record<string, any>;
}

const StructuredData: React.FC<StructuredDataProps> = ({ schema }) => {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default StructuredData;