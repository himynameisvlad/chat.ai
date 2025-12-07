import { type FormattedResponse } from '../../types';

interface FormattedResponseViewProps {
  data: FormattedResponse;
}

export function FormattedResponseView({ data }: FormattedResponseViewProps) {
  if (data.status === 'clarifying') {
    return (
      <div className="space-y-3">
        <div>
          <strong className="text-gray-900 text-base leading-relaxed block">
            {data.text}
          </strong>
        </div>
        {data.questions && data.questions.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Clarifying Questions:
            </div>
            <ul className="space-y-2">
              {data.questions.map((question, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-800"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="flex-1">{question}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <strong className="text-gray-900 text-base leading-relaxed block">
          {data.text}
        </strong>
      </div>
      {data.source && (
        <div>
          <i className="text-gray-600 text-sm block">
            {data.source}
          </i>
        </div>
      )}
    </div>
  );
}
