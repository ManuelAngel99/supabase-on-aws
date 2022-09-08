import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { WebACL } from './waf-web-acl';

interface SupabaseCdnProps {
  origin: elb.ILoadBalancerV2;
  requestRateLimit: number;
}

export class SupabaseCdn extends Construct {
  distribution: cf.Distribution;

  constructor(scope: Construct, id: string, props: SupabaseCdnProps) {
    super(scope, id);

    const { origin, requestRateLimit } = props;

    const webAcl = new WebACL(this, 'WebAcl', {
      Name: `${cdk.Aws.STACK_NAME}-${id}-WebAcl`,
      Description: 'Web ACL for self-hosted Supabase',
      Scope: 'CLOUDFRONT',
      Rules: [
        {
          Name: 'AWS-AWSManagedRulesAmazonIpReputationList',
          Priority: 0,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWS-AWSManagedRulesAmazonIpReputationList',
          },
          OverrideAction: { None: {} },
        },
        {
          Name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          Priority: 1,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          },
          OverrideAction: { None: {} },
        },
        {
          Name: 'AWS-AWSManagedRulesSQLiRuleSet',
          Priority: 2,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWS-AWSManagedRulesSQLiRuleSet',
          },
          OverrideAction: { None: {} },
        },
        {
          Name: 'AWS-AWSManagedRulesBotControlRuleSet',
          Priority: 3,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesBotControlRuleSet',
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWS-AWSManagedRulesBotControlRuleSet',
          },
          OverrideAction: { None: {} },
        },
        {
          Name: 'AWS-AWSManagedRulesATPRuleSet',
          Priority: 4,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesATPRuleSet',
              ExcludedRules: [
                { Name: 'SignalMissingCredential' },
              ],
              ManagedRuleGroupConfigs: [
                { LoginPath: '/auth/v1/token' },
                { PayloadType: 'JSON' },
                { UsernameField: { Identifier: '/email' } },
                { PasswordField: { Identifier: '/password' } },
              ],
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWS-AWSManagedRulesATPRuleSet',
          },
          OverrideAction: { None: {} },
        },
        {
          Name: 'RateBasedRule',
          Priority: 5,
          Statement: {
            RateBasedStatement: {
              Limit: requestRateLimit,
              AggregateKeyType: 'IP',
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'RateBasedRule',
          },
          Action: { Block: {} },
        },
      ],
    });

    const defaultBehavior: cf.BehaviorOptions = {
      origin: new LoadBalancerV2Origin(origin, {
        protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
      }),
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cf.AllowedMethods.ALLOW_ALL,
      cachePolicy: cf.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER,
    };

    const staticContentBehavior: cf.BehaviorOptions = {
      ...defaultBehavior,
      cachedMethods: cf.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
    };

    this.distribution = new cf.Distribution(this, 'Distribution', {
      webAclId: webAcl.arn,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      comment: `Supabase - CDN (${this.node.path}/Distribution)`,
      defaultBehavior,
      additionalBehaviors: {
        '*.css': staticContentBehavior,
        '*.png': staticContentBehavior,
        '*.jpg': staticContentBehavior,
        '*.jpeg': staticContentBehavior,
        '*.svg': staticContentBehavior,
        '*.woff': staticContentBehavior,
        '*.woff2': staticContentBehavior,
        '*.js': staticContentBehavior,
      },
      errorResponses: [
        { httpStatus: 500, ttl: cdk.Duration.seconds(10) },
        { httpStatus: 501, ttl: cdk.Duration.seconds(10) },
        { httpStatus: 502, ttl: cdk.Duration.seconds(10) },
        { httpStatus: 503, ttl: cdk.Duration.seconds(10) },
        { httpStatus: 504, ttl: cdk.Duration.seconds(10) },
      ],
    });
  }
};