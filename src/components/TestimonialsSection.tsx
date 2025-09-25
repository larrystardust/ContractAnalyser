import React from 'react';
import { useTranslation } from 'react-i18next';

interface Testimonial {
  textKey: string;
  authorKey: string;
  titleKey: string;
  avatarUrl: string;
}

const testimonials: Testimonial[] = [
  {
    textKey: 'testimonial_1_text',
    authorKey: 'testimonial_1_author',
    titleKey: 'testimonial_1_title',
    avatarUrl: 'https://images.pexels.com/photos/3771089/pexels-photo-3771089.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Pexels image
  },
  {
    textKey: 'testimonial_2_text',
    authorKey: 'testimonial_2_author',
    titleKey: 'testimonial_2_title',
    avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Pexels image
  },
  {
    textKey: 'testimonial_3_text',
    authorKey: 'testimonial_3_author',
    titleKey: 'testimonial_3_title',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Pexels image
  },
];

const TestimonialsSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12">
          {t('testimonials_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg shadow-md flex flex-col items-center">
              <img
                src={testimonial.avatarUrl}
                alt={t(testimonial.authorKey)}
                className="w-24 h-24 rounded-full object-cover mb-6 border-4 border-blue-200 dark:border-blue-700"
              />
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 italic">
                "{t(testimonial.textKey)}"
              </p>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t(testimonial.authorKey)}
              </h3>
              <p className="text-blue-600 dark:text-blue-400 text-sm">
                {t(testimonial.titleKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;