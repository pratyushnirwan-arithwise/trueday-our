import React from 'react';

const Question = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Questions</h2>
      <div className="space-y-4">
        {/* Add your question content here */}
        <p className="text-gray-600">No questions available at the moment.</p>
      </div>
    </div>
  );
};

export default Question; 