import React from 'react';
import ReactMarkdown from 'react-markdown';

interface FinalReportProps {
  reportContent: string; // The markdown content for the report
}

const FinalReport: React.FC<FinalReportProps> = ({ reportContent }) => {
  return (
    <div className="content-block-title p-6 rounded-md text-gray-800 overflow-y-auto p-5 mb-14">
      <h2 className="text-xl font-bold mb-4">Final Report</h2>
      <div className="markdown-content prose max-w-none">
        <ReactMarkdown>{reportContent}</ReactMarkdown>
      </div>
    </div>
  );
};

export default FinalReport;
