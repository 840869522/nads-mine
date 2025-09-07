import yaml
with open("config.yaml", 'r') as yml:
    config = yaml.safe_load(yml)
print(config)