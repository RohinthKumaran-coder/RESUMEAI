// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedRole =
  | 'Data Analyst' | 'Python Developer' | 'Machine Learning Engineer' | 'AI Engineer'
  | 'Software Engineer' | 'Full Stack Developer' | 'UI/UX Designer' | 'DevOps Engineer';

export interface RoleSkills {
  description: string;
  requiredSkills: string[];
  recommendedSkills: string[];
}

// ─── Role Skills Data ─────────────────────────────────────────────────────────

export const ROLE_SKILLS: Record<SupportedRole, RoleSkills> = {
  'Data Analyst': {
    description: 'Analyzes data to help organizations make informed business decisions.',
    requiredSkills: ['SQL', 'Python', 'Excel', 'Power BI', 'Statistics', 'Data Visualization', 'Data Cleaning', 'Tableau'],
    recommendedSkills: ['R', 'Google Analytics', 'BigQuery', 'Looker', 'Pandas', 'NumPy', 'A/B Testing'],
  },
  'Python Developer': {
    description: 'Builds scalable backend services and APIs using Python frameworks.',
    requiredSkills: ['Python', 'Django', 'Flask', 'REST APIs', 'PostgreSQL', 'Git', 'OOP', 'Data Structures', 'Algorithms', 'Unit Testing'],
    recommendedSkills: ['FastAPI', 'Docker', 'Redis', 'Celery', 'SQLAlchemy', 'Pytest', 'CI/CD', 'AWS'],
  },
  'Machine Learning Engineer': {
    description: 'Designs and implements machine learning systems and pipelines at scale.',
    requiredSkills: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Statistics', 'Deep Learning', 'Feature Engineering', 'MLOps', 'SQL', 'Docker'],
    recommendedSkills: ['NLP', 'Computer Vision', 'Kubernetes', 'Airflow', 'MLflow', 'Spark', 'Kafka', 'AWS SageMaker'],
  },
  'AI Engineer': {
    description: 'Builds production AI applications leveraging LLMs, RAG, and AI infrastructure.',
    requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'NLP', 'LLMs', 'RAG', 'LangChain', 'Vector Databases', 'API Development', 'Docker'],
    recommendedSkills: ['Computer Vision', 'TensorFlow', 'PyTorch', 'MLOps', 'Kubernetes', 'Fine-tuning', 'Prompt Engineering', 'OpenAI API'],
  },
  'Software Engineer': {
    description: 'Designs and builds robust software systems with strong CS fundamentals.',
    requiredSkills: ['Data Structures', 'Algorithms', 'System Design', 'Git', 'SQL', 'REST APIs', 'OOP', 'Design Patterns', 'Testing', 'Agile'],
    recommendedSkills: ['CI/CD', 'Docker', 'Kubernetes', 'Cloud (AWS/GCP/Azure)', 'Microservices', 'Message Queues', 'Caching'],
  },
  'Full Stack Developer': {
    description: 'Builds complete web applications from database to user interface.',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'PostgreSQL', 'REST APIs', 'Git', 'Responsive Design'],
    recommendedSkills: ['MongoDB', 'Docker', 'CI/CD', 'Redis', 'GraphQL', 'Next.js', 'AWS', 'Testing (Jest/Cypress)'],
  },
  'UI/UX Designer': {
    description: 'Creates intuitive, accessible, and visually compelling digital experiences.',
    requiredSkills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'Typography', 'Color Theory', 'Accessibility', 'Usability Testing'],
    recommendedSkills: ['Adobe XD', 'HTML', 'CSS', 'Motion Design', 'Information Architecture', 'A/B Testing', 'Sketch', 'After Effects'],
  },
  'DevOps Engineer': {
    description: 'Manages infrastructure, CI/CD pipelines, and cloud platforms for reliable deployments.',
    requiredSkills: ['Linux', 'Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Terraform', 'Shell Scripting', 'Monitoring', 'Networking', 'Git'],
    recommendedSkills: ['Ansible', 'Jenkins', 'Prometheus', 'Grafana', 'ELK Stack', 'Istio', 'ArgoCD', 'GCP', 'Azure', 'Vault'],
  },
};

export const SUPPORTED_ROLES = Object.keys(ROLE_SKILLS) as SupportedRole[];

export const SKILL_ALIASES: Record<string, string[]> = {
  'JavaScript': ['JS', 'Javascript', 'ES6', 'ES2015'],
  'TypeScript': ['TS', 'Typescript'],
  'Python': ['python3', 'py'],
  'PostgreSQL': ['Postgres', 'PSQL', 'pg'],
  'MongoDB': ['Mongo'],
  'React': ['React.js', 'ReactJS', 'React JS'],
  'Node.js': ['NodeJS', 'Node', 'Node JS'],
  'Express': ['Express.js', 'ExpressJS'],
  'Machine Learning': ['ML'],
  'Deep Learning': ['DL'],
  'Natural Language Processing': ['NLP'],
  'Computer Vision': ['CV'],
  'Artificial Intelligence': ['AI'],
  'CI/CD': ['CI CD', 'Continuous Integration/Continuous Deployment', 'DevOps Pipeline'],
  'REST APIs': ['REST', 'RESTful APIs', 'RESTful API', 'API Development'],
  'Git': ['GitHub', 'GitLab', 'Version Control'],
  'Docker': ['Containerization', 'containers'],
  'Kubernetes': ['K8s'],
  'Amazon Web Services': ['AWS'],
  'Google Cloud Platform': ['GCP'],
  'Microsoft Azure': ['Azure'],
  'SQL': ['MySQL', 'SQLite', 'MSSQL', 'Relational Databases'],
  'Power BI': ['PowerBI', 'Power Business Intelligence'],
  'TensorFlow': ['TF', 'Tensorflow'],
  'PyTorch': ['pytorch', 'Torch'],
  'Scikit-learn': ['sklearn', 'scikit learn'],
  'LangChain': ['langchain', 'Lang Chain'],
  'Figma': ['figma'],
  'OOP': ['Object Oriented Programming', 'Object-Oriented Programming'],
  'Data Structures': ['DSA', 'Data Structures and Algorithms'],
  'Algorithms': ['DSA', 'Algorithm Design'],
  'System Design': ['Architecture', 'System Architecture'],
};