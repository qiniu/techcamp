import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '开源公开',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        过程公开，结果开源，倒逼高质量产出。让优秀的工程师容易被看见，在真实项目中锤炼工程思维。
      </>
    ),
  },
  {
    title: 'AI Native',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        倡导 Build/Think/Code With AI，让 AI 成为你最强大的伙伴。拥抱 AI 时代，共同创造未来。
      </>
    ),
  },
  {
    title: '资深带教',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        资深专家全程陪跑，代码逐行审阅，架构反复推敲。坚持高工程标准，培养工匠精神。
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
