import { type FormattedResponse } from '../../types';

/**
 * Props for the FormattedResponseView component
 */
interface FormattedResponseViewProps {
  data: FormattedResponse;
}

/**
 * FormattedResponseView Component
 * Renders a formatted JSON response with styled text, source, and tags
 */
export function FormattedResponseView({ data }: FormattedResponseViewProps) {
  return (
    <div className="space-y-3">
      <div>
        <strong className="text-gray-900 text-base leading-relaxed block">
          {data.text}
        </strong>
      </div>
      <div>
        <i className="text-gray-600 text-sm block">
          {data.source}
        </i>
      </div>
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
