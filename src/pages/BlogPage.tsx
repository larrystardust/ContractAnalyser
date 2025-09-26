import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../data/blogData'; // Import the blog posts data
import { ArrowLeft } from 'lucide-react';

const BlogPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Landing Page
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Blog</h1>
      <p className="text-lg text-gray-700 mb-10">Stay updated with the latest insights on AI in legal tech, contract analysis, and business protection.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogPosts.map((post) => (
          <div key={post.slug} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
            {post.imageUrl && (
              <img src={post.imageUrl} alt={post.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                <Link to={`/blog/${post.slug}`} className="hover:text-blue-600">
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                By {post.author} on {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-gray-700 text-base mb-4">
                {post.excerpt}
              </p>
              <Link to={`/blog/${post.slug}`} className="text-blue-600 hover:text-blue-800 font-medium">
                Read More &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlogPage;